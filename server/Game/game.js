const Booth = require('./booth');
const playerRole = require('./players');

class Game {
  constructor(room, io, users, warden){
	  var userstemp = new Map(users);
	  this._round = 1;
	  this._warden = warden;
	  this._teams = []
	  this._booths = []
	  this._room = room;
	  this._io = io;
	  this._io.to(warden).emit('set-up', (this._room, {_name: users.get(warden)._name, _role: "Warden", _points: "N/A"}))
	  this._nameList = [[`${users.get(warden)._name} | Warden`],[],[]]
	  userstemp.delete(warden)
	  this._partners = [null, null]
	  this._killer = null;
	  this._snitch = null;
	  this._inmates = this.assignPlayerRoles(userstemp);
	  for(let [socketID, playerRole] of this._inmates){
		  this._io.to(socketID).emit('set-up', (this._room, playerRole))
	  }
	  this._teamColors = ["#FF0000", "#00FF00", "#0000FF", "#0000FF", "#FF00FF"]
	  this.makeNameArray();
	  this._specialRounds = ["Team", "Solitary", "Prom", "Lightning", "Sacrifice"];
	  this._awaitingResponse = null;
	  this._selectingUser = null;
	  this._votingTime = false;
	  this._sacrificeVoteTime = false;
	  this._winners = []
	  this._timeLimit;
	  this._timer;
	  this._truthVotes = new Map([["truth", []], ["normal", []]])
	  this._truthRound = 0;
	  
  }
  
  addTeam(prisoners){
	  this._teams.push(new Team(prisoners))
  }
  
  findTeamOfUser(prisoner){
	  return this._teams.find(team => team._inmates.includes(prisoner))
  }
  
  startRound() {
	  if(this._round == 10 || this._inmates.size == 0){
		  this.wardenWin()
	  } else {
		  if(this._round % 3 == 0){
			  this.truthSetup(this._inmates);
		  }
	   else if(this._round % 2 != 0) {
		   this._timeLimit = 180;
		   this.defaultRound();
	   } else {
		   this._awaitingResponse = this.roundTypeSetup()
		   this._awaitingResponse.next();
	   }
   }
  }
   defaultRound() {
	  let socketIDs = Array.from(this._inmates.keys());
	  if (socketIDs.length > 1 && socketIDs.length <= 9) {
		  
		  if(socketIDs.length % 2 != 0) {
			  this._awaitingResponse = this.pair2Prisoners();
			  this._awaitingResponse.next();
			  }
		   else {
			  this.restOfPlayers(socketIDs)
		  }
	  }
   }
  
  *pair2Prisoners(){
	  this._selectingUser = this._warden;
	   let players = Array.from(this._inmates.values())
	   for(var i = 0; i < players.length; i++){
		    this._io.to(this._warden).emit('chat-message', i + " " + players[i].playerStatus())
	   }
	   this._io.to(this._warden).emit('chat-message', "Please select 2 Prisoners to pair in this format: !select # #");
	   var pair;
	   while(true){
	   var pair = yield this._warden;
	    if(pair.length == 2 && pair[0] != pair[1] &&
		   pair[0] >= 0 && pair[0] < this._inmates.size &&
		   pair[1] >= 0 && pair[1] < this._inmates.size
		   ){
			   break;
		   } else{
			   this._io.to(this._warden).emit('chat-message', 'invalid input, please try again')
		   }
	   }
	   let socketIDs = Array.from(this._inmates.keys());
	  let p1 = socketIDs[pair[0]]
	  let p2 = socketIDs[pair[1]]
	  this.addTeam([p1, p2]);
	  socketIDs.splice(socketIDs.indexOf(p1), 1)
	  socketIDs.splice(socketIDs.indexOf(p2), 1)
	  this.restOfPlayers(socketIDs);
	  
  }
  
    restOfPlayers(players) {
	  players.forEach(player => {
		  this.addTeam([player])
	  })
	  this.createBooths();
	  this.assignTeamColors();
	  this._io.in(this._room).emit('show-booths', this._booths.length);
	  this._io.in(this._room).emit('timer', this._timeLimit)
	  this.startTimer()
	  this._io.in(this._room).emit('chat-message', 'Round Start!')
	  this._votingTime = true;
	  
	  
  }
  
    *roundTypeSetup(){
	  this._timeLimit = 180;
	  for(var i = 0; i < this._specialRounds.length; i++){
		  this._io.to(this._warden).emit('chat-message', `${i}: ${this._specialRounds[i]}`);
	  }
	  this._io.to(this._warden).emit('chat-message', 'Select one of these options for the next round using !select #');
	  var round = null;
	  this._selectingUser = this._warden;
	  while(round == null || !(round[0] >= 0 && round[0] < this._specialRounds.length)){
		  round = yield this._warden;
		  if(!(round[0] >= 0 && round[0] < this._specialRounds.length)){
			  this._io.to(this._warden).emit('chat-message', "Invalid Input. Please Try Again");
		  }
	  }
	  var roundType = this._specialRounds[round[0]];
	  this._specialRounds.splice(round[0], 1);
		  switch(roundType){
		case "Team":
			this._awaitingResponse = this.teamRoundSetup()
			this._awaitingResponse.next()
			break;
			break;
		case "Solitary":
			this._awaitingResponse = this.solitarySetup()
			this._awaitingResponse.next()
			break;
		case "Prom":
		    this._awaitingResponse = this.prisonPromSetup()
			this._awaitingResponse.next()
			break;
		case "Sacrifice":
		this.sacrificeRoundSetup();
			break;
		case "Truth":
			this.truthSetup(this._inmates);
			break;
		case "Lightning":
			this._timeLimit = 18;
			this.defaultRound();
			break;
		default:
		    this._io.in(this._room).emit('chat-message', "idk how this happened but i guess it's default round time")
			this.defaultRound();
	  }
	  
	  
  }
  
  *teamRoundSetup(){
	  let inmates = new Map(this._inmates)
	   for(var i = 0; i < inmates.size; i++){
		    this._io.to(this._warden).emit('chat-message', i + " " + Array.from(inmates.values())[i].playerStatus())
	   }
	   this._io.to(this._warden).emit('chat-message', "Please select 2 Prisoners as captains in this format: !select # #");
	   this._selectingUser = this._warden;
	   let captains = null;
	   while(true){
		   captains = yield this._warden;
		   if(captains.length == 2 && captains[0] != captains[1] &&
		   captains[0] >= 0 && captains[0] < inmates.size &&
		   captains[1] >= 0 && captains[1] < inmates.size
		   ){
			   break;
		   }else{
			   this._io.to(this._warden).emit('chat-message', 'invalid input, please try again')
		   }
		   
	   }
	   
	   let c1 = Array.from(inmates.keys())[captains[0]]
	   let c2 = Array.from(inmates.keys())[captains[1]]
	   const teams = [[c1],[c2]]
	   inmates.delete(c1)
	   inmates.delete(c2)
	   var toggle = 0
	   var pickedNum;
	   var pickedInmate;
	   while(inmates.size > 0){
		   for(var i = 0; i < inmates.size; i++){
				this._io.to(teams[toggle][0]).emit('chat-message', i + " " + Array.from(inmates.values())[i].playerStatus())
	   }
		
			this._io.to(teams[toggle][0]).emit('chat-message', "Please select 1 Prisoner to join your team in this format: !select #");
			this._selectingUser = teams[toggle][0]
			while(true){
			pickedNum = yield teams[toggle][0];
			if(pickedNum >= 0 && pickedNum < inmates.size){
				break;
			} else{
				this._io.to(this._selectingUser).emit('chat-message', 'invalid input, please try again')
			}
			}
			pickedInmate = Array.from(inmates.keys())[pickedNum]
			teams[toggle].push(pickedInmate);
			inmates.delete(pickedInmate)
			toggle = 1 - toggle
	   }
	   this.addTeam(teams[0]);
	   this.addTeam(teams[1]);
	   this.assignTeamColors()
	   this.createBooths();
	   this._votingTime = true;
	   this._io.in(this._room).emit('show-booths', this._booths.length);
	   this.startTimer();
	   this._io.in(this._room).emit('timer', this._timeLimit)
	   this._io.in(this._room).emit('chat-message', 'Round Start!');
  }
  
  *solitarySetup(){
	  let copy = new Map(this._inmates)
	  let players = Array.from(copy.values())
	   for(var i = 0; i < players.length; i++){
		    this._io.to(this._warden).emit('chat-message', i + " " + players[i].playerStatus())
	   }
	   this._io.to(this._warden).emit('chat-message', "Please select 1 Prisoners to put in Solitary in this format: !select #");
	   var solitaryNum = null;
	   while(true){
		   solitaryNum = yield this._warden;
		   if(solitaryNum[0] >= 0 && solitaryNum[0] < this._inmates.size){
			   break;
		   } else {
			   this._io.to(this._warden).emit('chat-message', 'invalid input, please try again')
		   }
	   }
	   let socketIDs = Array.from(copy.keys());
	   let solitaryPrisoner = socketIDs.splice(solitaryNum[0], 1)
	   this.addTeam(solitaryPrisoner);
	   this.addTeam(socketIDs);
	   this.createBooths();
	   this.assignTeamColors();
	   this._votingTime = true;
	   this._io.in(this._room).emit('show-booths', this._booths.length);
	   this.startTimer();
	   this._io.in(this._room).emit('timer', this._timeLimit)
	   this._io.in(this._room).emit('chat-message', 'Round Start!');
	   
  }
  
  
  
  
  
  
  
  sacrificeRoundSetup(){
	  this._sacrificeVotes = new Map(this._inmates)
	  this._sacrificeVotes.forEach((value, key) => this._sacrificeVotes.set(key, []))
	  this._sacrificeVoteTime = true;
	  //iterates over each prisoner
	  for(var i = 0; i < this._inmates.size; i++){
		  //lists all the prisoners to each prisoner
		  for(var j = 0; j < this._inmates.size; j++){
			  this._io.to(Array.from(this._inmates.keys())[i]).emit('chat-message', j + " " + Array.from(this._inmates.values())[j].playerStatus())
		  }
			  this._io.to(Array.from(this._inmates.keys())[i]).emit('chat-message', "Please select 1 Prisoner to vote for in this format: !vote #")
			  
				  }
				  console.log(this._sacrificeVotes)
  }
  
  sacrificeReceiveVote(voter, voteNumber){
	  if(voteNumber >= 0 && voteNumber < this._inmates.size){
		  this._sacrificeVotes.get(Array.from(this._inmates.keys())[voteNumber]).push(voter);
		  console.log(this._sacrificeVotes)
	  } else{
				this._io.to(voter).emit('chat-message', 'invalid input, please try again')
			}
	if(this.totalVotes(this._sacrificeVotes) == this._inmates.size){
		this._sacrificeVotes = new Map([...this._sacrificeVotes.entries()].sort((a,b) => b[1].length - a[1].length))
		console.log(this._sacrificeVotes)
		if(Array.from(this._sacrificeVotes.values())[0].length == Array.from(this._sacrificeVotes.values())[1].length){
			this._inmates.forEach((prisoner, id) => {
				prisoner.changePoints(2);
			})
		}else{
			if(Array.from(this._sacrificeVotes.values())[0].length > (this._inmates.size / 2)){
			Array.from(this._sacrificeVotes.values())[0].forEach(prisoner => {
				this._inmates.get(prisoner).changePoints(3)
			})
	}
		this._inmates.get(Array.from(this._sacrificeVotes.keys())[0]).changePoints(-6)
	}
	this._inmates.forEach((prisoner, id) => {
		this._io.to(id).emit('set-up', (this._room, prisoner))
	})
	this.deathCheck();
	this._sacrificeVoteTime = false;
	this._round += 1;
	this.makeNameArray()
	this.startRound()
	}
  }
  
   *prisonPromSetup(){
	let inmates = new Map(this._inmates)
	while(inmates.size > 1){
		for(var i = 0; i < inmates.size; i++){
		    this._io.to(this._warden).emit('chat-message', i + " " + Array.from(inmates.values())[i].playerStatus())
	   }
	   this._io.to(this._warden).emit('chat-message', "Please select 2 Prisoners in this format: !select # #");
	   this._selectingUser = this._warden;
	   var date;
	   var d1;
	   var d2;
	   while(true){
		   date = yield this._warden;
		   if(date.length == 2 && date[0] != date[1] &&
		   date[0] >= 0 && date[0] < inmates.size &&
		   date[1] >= 0 && date[1] < inmates.size
		   ){
			   break;
		   }else{
			   this._io.to(this._warden).emit('chat-message', 'invalid input, please try again')
		   }
	   }
	   d1 = Array.from(inmates.keys())[date[0]]
	   d2 = Array.from(inmates.keys())[date[1]]
	   this.addTeam([d1, d2])
	   inmates.delete(d1)
	   inmates.delete(d2)
	}
	if(inmates.size == 1 && this._teams.length != 1){
		this._selectingUser = Array.from(inmates.keys())[0]
		for(var i = 0; i < this._teams.length; i++){
			this._io.to(this._selectingUser).emit('chat-message', `${i}: ${this._teams[i][0]._name} & ${this._teams[i][1]._name}`)
		}
		this._io.to(this._selectingUser).emit('chat-message', 'Please select a couple to third-wheel in this format: !select #')
		while(true){
			date = yield this._selectingUser;
			if(date[0] >= 0 && date[0] < this._teams.length){
				this._teams[date[0]]._inmates.push(this._selectingUser);
				 this.assignTeamColors()
	             this.createBooths();
	             this._votingTime = true;
	             this._io.in(this._room).emit('show-booths', this._booths.length);
	             this.startTimer();
	             this._io.in(this._room).emit('timer', this._timeLimit)
	             this._io.in(this._room).emit('chat-message', 'Round Start!');
				return;
			}
			else{
				this._io.to(this._selectingUser).emit('chat-message', 'invalid input, please try again')
			}
		}
	} else{
		this.assignTeamColors()
	    this.createBooths();
	    this._votingTime = true;
	    this._io.in(this._room).emit('show-booths', this._booths.length);
	    this.startTimer();
	    this._io.in(this._room).emit('timer', this._timeLimit)
	    this._io.in(this._room).emit('chat-message', 'Round Start!');
	}

  }
  
  truthOrDefaultSetup(){
	  this._inmates.forEach((value, key) => {
		  this._io.to(key).emit('chat-message', "For the opprotunity to learn another prisoner's role, type !truth")
		  this._io.to(key).emit('chat-message', "Else, type !pass to play a normal round")
	  })
	  this._truthRound ++;
  }
  
  truthOrDefaultReceiveVote(id, vote){
	  if(this._truthVotes.get("truth").includes(id) ||
	     this._truthVotes.get("normal").includes(id)){
			 this._io.to(id).emit('chat-message', 'you have already voted!')
		 }else{
			 this._truthVotes.get(vote).push(id)
			 console.log(this._truthVotes)
			 if(this._truthVotes.get("truth").length +
			    this._truthVotes.get("normal").length == this._inmates.size){
					if(this._truthVotes.get("truth").length >=
					   this._truthVotes.get("normal").length){
						   this.truthSetup(this._inmates)
					   }else{
						   this.defaultRound()
					   }
				}
		 }
  }
  
  truthSetup(prisoners){
	   for(var i = 0; i < this._inmates.size; i++){
		  //lists all the prisoners to each prisoner
		  for(var j = 0; j < prisoners.size; j++){
			  
			  this._io.to(Array.from(this._inmates.keys())[i]).emit('chat-message', j + " " + Array.from(prisoners.values())[j].playerStatus())
		  }
			  this._io.to(Array.from(this._inmates.keys())[i]).emit('chat-message', "Please select 1 Prisoner to reveal their role in this format: !truth #")
			  
				  }
		this._truthVotes = new Map(prisoners)
		this._truthVotes.forEach((value, key) => this._truthVotes.set(key, []))
		
		this._truthRound ++;
  }
  
  truthRoundReceiveVote(voter, voteNumber){
	  if(voteNumber >= 0 && voteNumber < this._truthVotes.size &&
	  this.hasNotVoted(voter, this._truthVotes)){
		  this._truthVotes.get(Array.from(this._truthVotes.keys())[voteNumber]).push(voter);
		  
	  } else{
				this._io.to(voter).emit('chat-message', 'invalid input, please try again')
			}
	if(this.totalVotes(this._truthVotes) == this._inmates.size){
		this._truthVotes = new Map([...this._truthVotes.entries()].sort((a,b) => b[1].length - a[1].length))
		//if there is a tie
		if(Array.from(this._truthVotes.values())[0].length == Array.from(this._truthVotes.values())[1].length){
			//if round is 1
			if(this._truthRound == 1){
				//take the length of the tied votes
				var tie = Array.from(this._truthVotes.values())[0].length
				//check all truthVote values, delete any key,value pair with less than the tie vote number
				for(let [k,v] of this._truthVotes.entries()){
					if(v.length != tie){
						this._truthVotes.delete(k)
					} else {
						this._truthVotes.set(k,this._inmates.get(k))
					}
				}
				//run truthSetup again with the saved values
				this._truthRound++;
				this.truthSetup(this._truthVotes)
			}
			//else if round is 3
			else{
				//pick a prisoner at random from the list
				
				var random = Array.from(this._truthVotes.keys())[Math.floor(Math.random() * this._truthVotes.size())];
				this._io.in(this._room).emit('chat-message', `${this._inmates.get(random).fullPlayerStatus()}`)
				/*
				Array.from(this._truthVotes.keys()).forEach(prisoner => {
				this._inmates.get(prisoner).changePoints(2)
				})
				this.makeNameArray()
				*/
				 
		  this._truthRound = 0;
				//next round start
				 if(this._round % 2 != 0) {
		   this._timeLimit = 180;
		   this.defaultRound();
	   } else {
		   this._awaitingResponse = this.roundTypeSetup()
		   this._awaitingResponse.next();
	   }
				
			}
	} //if there is no tie
	else {
		//chat-message to all prisoners the full details of the prisoner in this._truthVotes[0]
		var truthReveal = Array.from(this._truthVotes.keys())[0]
		this._io.in(this._room).emit('chat-message', `${this._inmates.get(truthReveal).fullPlayerStatus()}`)
		
		
		//next round start
		this._truthRound = 0;
		 if(this._round % 2 != 0) {
		   this._timeLimit = 180;
		   this.defaultRound();
	   } else {
		   this._awaitingResponse = this.roundTypeSetup()
		   this._awaitingResponse.next();
	   }
		
		
	}
  }
  }
  
  
 
  hasNotVoted(prisoner, list){
	  for (var votes of list.values()){
		  if(votes.includes(prisoner)){
			  
			  return false;
		  }
	  }
	  return true;
  }
  
  totalVotes(list){
	  var i = 0;
	  list.forEach(votes => {
		  i += votes.length;
	  })
	  return i;
	  
  }
  
  
 
  
  

  
  createBooths() {
	  for(var i = 0; i < this._teams.length / 2; i++) {
		  this._booths.push(new Booth(this._room, this._io));
	  }
  }
  
  enterBooth(user, boothNumber, sideIndex) {
	  if(this._votingTime){
	  if(this.findTeamOfUser(user)._vote){
		  for(var inmate of this.findTeamOfUser(user)._inmates){
			  this._io.to(inmate).emit('chat-message', 'You have already voted. You may not change your vote or switch booths.')
		  }
	  }else{
	  this._booths[boothNumber].enterSide(this.findTeamOfUser(user), sideIndex);
	  this.putNamesInBooth(boothNumber);
	  }
	  } 
  }
  
  putNamesInBooth(boothNumber){
	  for(var i = 0; i < 2; i++){
	  var names = this._booths[boothNumber].getSide(i);
	  if(names){
	  var nameString = ""
	  if(names.length < 3){
		  names.forEach(name => {
			  nameString += this._inmates.get(name)._name + "\n"
		  })
	  }else{
		  nameString = this._inmates.get(names[0])._name + "\n" + this._inmates.get(names[1])._name + "\n" + this._inmates.get(names[2])._name + "\n ..."
	  }
	  this._io.in(this._room).emit('show-in-booth', `b-${boothNumber}-${i}`, nameString)
  }else{
	   this._io.in(this._room).emit('show-in-booth', `b-${boothNumber}-${i}`, `${this._booths[0]._sideID[i]}`)
  }
  }
  }
  
  sendVote(user, vote) {
	  if(this._votingTime){
	  if(this.findTeamOfUser(user)._vote){
		  this._io.to(user).emit('chat-message', 'You have already made your vote for this round.')
	  } else{
	  var boothIndex = this._booths.findIndex(booth => booth._sides.includes(this.findTeamOfUser(user)._inmates)) 
	  if(boothIndex == -1) {
		  this._io.to(user).emit('chat-message', 'Please enter a booth first');
	  }
	  else {
	  this._booths[boothIndex].recieveVote(this.findTeamOfUser(user)._inmates, vote);
	  var teamIndex = this._teams.findIndex(team => team == this.findTeamOfUser(user))
	  this._teams[teamIndex]._vote = vote
	  }
	  if(this._teams.every(team => team._vote != null) && this._timer != null){
		  clearTimeout(this._timer)
		  this._timer = null
		  this._io.in(this._room).emit('timer', -1)
		  this.checkAllBooths();
	  }
  }
	  }
  }
  
  checkAllBooths(){
	  this._votingTime = false;
	  this._io.in(this._room).emit('show-booths', 0);
		  this._booths.forEach(booth => {
			var results = booth.checkResults()
			for(const [socketID, points] of Object.entries(results)) {
				if(socketID != null){
				this._inmates.get(socketID).changePoints(points);
				this._io.to(socketID).emit('set-up', (this._room, this._inmates.get(socketID)));
				}
			}
		  })
		  this._teams = []
		  this._booths = []
		  this.deathCheck();
		  this._round += 1;
		  this.makeNameArray()
		  this._awaitingResponse = this.winCheck()
		  this._awaitingResponse.next()
		  
	  
  }
  
  
 
   
   
  startTimer(){
	  this._timer = setTimeout(()=> {this.timeUp()}, (this._timeLimit * 1000))
  }  
   
   timeUp() {
	   this.timer = null
	   this._teams.forEach(team => {
		   if(!team._inBooth){
			   team._inmates.forEach(inmate => {
				   this._inmates.get(inmate).instaKill();
				   this._io.to(inmate).emit('set-up', (this._room, this._inmates.get(inmate)));
			   })
		   }
		   else if(team._vote == null){
			   this.sendVote(team._inmates[0], 'ally');
		   }
	   })
	   this.checkAllBooths()
   }
   
     *winCheck(){
	  this._inmates.forEach((value, key) => {
		  if(value.enoughPoints(this._inmates)){
			  this._winners.push(key)
			  console.log(this._winners)
		  }
	  })
	  if(this._winners.length > 0){
		  this._winners.forEach(id => {
			  console.log("testing")
			  this._io.to(id).emit('chat-message', "You can escape! Enter !escape in the next 9 seconds to leave!")
		  })
		    this.timer = setTimeout(()=> {this._awaitingResponse.next(false)}, 9000)
			let response = yield this._winners;
			if(response){
				if(this._inmates.has(this._killer) && this._inmates.get(this._killer)._canWin &&
				this._winners.length == 1){
					this._winners = [this._killer]
				}
				else if(this._winners.includes(this._snitch)){
					this._winners = [this._snitch]
				}
				this._io.in(this._room).emit('chat-message', 'GAME OVER! WINNERS:')
				this._winners.forEach(id => {
				this._io.in(this._room).emit('chat-message', `${this._inmates.get(id)._name}`)
				this._io.to(this._warden).emit('game-over', this._room)
				})
			}else{
				this._winners = []
				this.startRound();
			}
	  } else{
		  this.startRound();
	  }
  }
  
  wardenWin(){
	  this._io.in(this._room).emit('chat-message', 'Game Over! Warden Wins!');
	  this._io.to(this._warden).emit('game-over', this._room)
  }
  
   
   deathCheck(){
	   console.log(this._teams)
	   var deaths = new Set()
	   this._inmates.forEach((prisoner, id) => {
		   if(!prisoner.isStillAlive()){
			   this._io.in(this._room).emit('chat-message', `${prisoner._name} has been eliminated.`)
			   deaths.add(id);
			   if(this._inmates.has(this._killer)){
				   this._io.to(this._killer).emit('chat-message', 'a player has died! wait for your opprotunity to escape!')
				   this._inmates.get(this._killer)._canWin = true;
			   }
		   }
	   })
	   if(deaths.has(this._partners[0]) || deaths.has(this._partners[1])){
		   this._io.in(this._room).emit('chat-message', `Partners ${this._inmates.get(this._partners[0])._name} and ${this._inmates.get(this._partners[1])._name} have been eliminated.`)
		   deaths.add(this._partners[0])
		   deaths.add(this._partners[1])
	   }
	   deaths.forEach(id => {
		   this._inmates.delete(id)
		   })
		   
	   }
	   
   
   
   
  resetRound(){
	  this._io.in(this._room).emit('chat-message', "due to a disconnect, this round will be reset")
	  if(this._timer != null){
		  clearTimeout(this._timer)
	  }
	 this._io.to(this._room).emit('timer', -1)
	 this._teams = [];
	 this._booths = [];
	 this._truthVotes = new Map([["truth", []], ["normal", []]])
	 this._sacrificeVotes = null;
	 this._votingTime = false;
	 this._truthRound = 0;
	 this._sacrificeVoteTime = false;
	 this._awaitingResponse = null;
	 this.startRound()
  }
  
  
  makeNameArray(){
	  var newWardenArray = []
	  var newPartnerArray = []
	  var newInmateArray = []
	  
	  newWardenArray.push(this._nameList[0][0])
	  newPartnerArray.push(this._nameList[0][0])
	  newInmateArray.push(this._nameList[0][0])
	  this._inmates.forEach((player) => {
		  var name = `${player._name} | ${player._points}P`
		  newInmateArray.push(name)
		  if(player._role == "partner"){
			  name = "(p) " + name
			  newPartnerArray.push(name)
			  newWardenArray.push(name)
		  }
		  else if(player._role != "inmate"){
			  newPartnerArray.push(name)
			  name = `(${player._role.charAt(0)}) ` + name
			  newWardenArray.push(name)
		  } else{
			  newPartnerArray.push(name)
			  newWardenArray.push(name)
		  }
		  
	  })
	  this._nameList = [newWardenArray, newPartnerArray, newInmateArray]
	  this._io.to(this._warden).emit('names', this._nameList[0])
	  if(this._partners[0] != null &&
	     this._inmates.has(this._partners[0])){
			 this._io.to(this._partners[0]).emit('names', this._nameList[1])
			 this._io.to(this._partners[1]).emit('names', this._nameList[1])
		 }
	  this._inmates.forEach((inmate, id) => {
		  if(inmate._role != "partner"){
			  this._io.to(id).emit('names', this._nameList[2])
		  }
	  })
  }
  assignTeamColors(){
	  var colorIndex = 0
	  this._teams.forEach(team => {
		  if(team._inmates.length > 1){
			  team._inmates.forEach(prisoner => {
				  var name = this._inmates.get(prisoner)._name
				  var nameIndex = this._nameList[0].findIndex(userName => userName.includes(`${name} `))
				  this._nameList.forEach(list => {
					  list[nameIndex] = this._teamColors[colorIndex] + list[nameIndex]
				  })
			  })
			  colorIndex++
		  }
	  })
	  if(colorIndex > 0){
	  this._io.to(this._warden).emit('names', this._nameList[0])
	  if(this._partners[0] != null &&
	     this._inmates.has(this._partners[0])){
			 this._io.to(this._partners[0]).emit('names', this._nameList[1])
			 this._io.to(this._partners[1]).emit('names', this._nameList[1])
		 }
	  this._inmates.forEach((inmate, id) => {
		  if(inmate._role != "partner"){
			  this._io.to(id).emit('names', this._nameList[2])
		  }
	  })
	  }
  }
  
  
  assignPlayerRoles(users){

	  let socketIDs = Array.from(users.keys());
	  //shuffle the IDs 
	  for(let i = socketIDs.length - 1; i > 0; i--){
		  const j = Math.floor(Math.random() * i);
		  const temp = socketIDs[i];
		  socketIDs[i] = socketIDs[j];
		  socketIDs[j] = temp;
	  }
	  console.log('users shuffled')
	  if(socketIDs.length >= 8){
		  const killer = socketIDs.pop()
		  users.set(killer, new playerRole.Killer(users.get(killer)._name))
		  this._killer = killer;
	  }
	  
	  if(socketIDs.length >= 6){
		  const partner1 = socketIDs.pop()
		  const partner2 = socketIDs.pop()
		  users.set(partner1, new playerRole.Partner(users.get(partner1)._name, partner2))
		  users.set(partner2, new playerRole.Partner(users.get(partner2)._name, partner1))
		  this._partners = [partner1, partner2];
		  console.log('partners assigned')
	  }
	  const snitch = socketIDs.pop()
	  users.set(snitch, new playerRole.Snitch(users.get(snitch)._name))
	  socketIDs.forEach(inmate => {
		  users.set(inmate, new playerRole.Inmate(users.get(inmate)._name))
	  })
	  return users;
  }

  
}
  
  
  


  class Team {
	constructor(players){
		this._inmates = players;
		//this._playerIDs = players.map(x => x.id);
		this._vote = null;
		this._inBooth = false;
	}
	
	set vote(vote){
		this._vote = vote
	}
	
	
}

module.exports = Game;