


class Booth {
	constructor(room, io){
		this._room = room;
		this._io = io;
		this._sides = [null, null];
		this._votes = [null, null];
		
		
	}
	
	get sides(){
		return this._sides;
	}
	
	
	
	enterSide(team){
		if(this._sides[0] && this._sides[1]){
			this.msgSide(team, "occupado!")
		}
		
		
		else if(!this._sides[0]) {
			this._sides[0] = team
		    this.msgSide(team, "Entered side A")
			}
		else {
			this._sides[1] = team
			this.msgSide(team, "Entered side B")
			
	}
	}
	
	
	msgSide(team, msg){
		team.forEach(player => {
			this._io.to(player).emit('chat-message', msg)
		})
	}
	msgBothSides(msg){
		this._sides.forEach(side => {
			this.msgSide(side, msg)
		})
	}
	
	relaySide(side, info){
		side.forEach(player => {
			player.emit('relay', info)
		})
	}
	
	assignPlayerPoints(dict, side, points){
		side.forEach(player => {
			dict[player] = points
		})
	}
	
	
	recieveVote(team, vote) {
		var sideIndex = this._sides.indexOf(team);
		if(this._votes[sideIndex]){
			this.msgSide(team, "You have already voted. Please Wait.")
		}
		else{
		this._votes[sideIndex] = vote;
		this.msgSide(team, `You have chosen ${vote}`);
		}
	}
	

   checkResults() {
	   var votes = this._votes;
	   var results = {}
	   
	   if(votes[1] == null){
		   if(votes[0] == "ally"){
			   this.msgSide(this._sides[0], "ally default")
		   this.assignPlayerPoints(results, this._sides[0], 2)
		   }
		   else if(votes[0] == "betray"){
			    this.msgSide(this._sides[0], "betray default")
		   this.assignPlayerPoints(results, this._sides[0], 3)
		   }
	   }
	   
	   else if(votes[0] == "ally" && votes[1] == "ally") {
		   this.msgBothSides('yay friendship!');
		   this._sides.forEach(side => {
			   this.assignPlayerPoints(results, side, 2)
		   })
	   } else if(votes[0] == "ally" && votes[1] == "betray") {
		   this.msgSide(this._sides[0], "u dun fucked up")
		   this.assignPlayerPoints(results, this._sides[0], -2)
		   this.msgSide(this._sides[1], "u sly dog")
		   this.assignPlayerPoints(results, this._sides[1], 3)
	   } else if(votes[0] == "betray" && votes[1] == "ally") {
		   this.msgSide(this._sides[1], "u dun fucked up")
		   this.assignPlayerPoints(results, this._sides[1], -2)
		   this.msgSide(this._sides[0], "u sly dog")
		   this.assignPlayerPoints(results, this._sides[0], 3)
	   } else if(votes[0] == "betray" && votes[1] == "betray"){
		   this.msgBothSides("both have betrayed")
	   }
		   this._votes = [null, null];
		   this._sides = [null, null];
		   return results;
		    
	   }
	  
   
}
module.exports = Booth;