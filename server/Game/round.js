Class Team {
	constructor(players){
		this._players = players;
		this._vote = null;
	}
}



Class Game {
  constructor(){
	  this._round = 1;
	  this._teams = []
  }
  
  addTeam(players) {
	  this._teams.push(new Team(players))
  }




}