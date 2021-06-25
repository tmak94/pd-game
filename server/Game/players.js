class Player {
  constructor(name){
    this._name = name;
    this._role = "";
    this._points = 3;
    this._isAlive = true;
	this._canWin = false;
  }
  
  get name(){
    return this._name;
  }
  
  set name(newName){
    this._name = newName;
  }
  
  get role(){
    return this._role;
  }
  
  set role(newRole){
    this._role = newRole;
  }
  
  get points(){
    return this._points;
  }
  
  set points(newPoints){
    this._points = newPoints;
  }
  
  get isAlive(){
    return this._isAlive;
  }
  
  set isAlive(newIsAlive){
    this._isAlive = newIsAlive;
  }
  
   enoughPoints(){
	 this._canWin = this._points >= 9;
	 return this._canWin;
 }
  
  changePoints(number){
    this._points += number;
  }
  
  playerStatus(){
	  return `${this._name}: ${this._points} points`
  }
  fullPlayerStatus(){
	  return `${this._name}: ${this._role}, ${this._points} points`
  }
  
  isStillAlive(){
    this._isAlive = this._points > 0;
	return this._isAlive;
  }
  
  instaKill(){
	  this._points = 0;
  }
}

class Inmate extends Player{
	constructor(name){
		super(name);
		this._role = "inmate";
	}
	
	
}



class Snitch extends Player{
	constructor(name){
		super(name);
		this._role = "snitch";
	}
	
	
	
}

class Partner extends Player{
	constructor(name, partner) {
		super(name);
		this._role = "partner";
		this._partner = partner;
	}
	assignPartner(p){
		this._partner = p;
	}
	
	enoughPoints(playerList){
		this._canWin = this._points + playerList.get(this._partner)._points >= 17;
		return this._canWin;
	}
}

class Killer extends Player{
	constructor(name) {
		super(name);
		this._role = "killer";
	}
	
	enoughPoints(){
		return false;
	}
}
module.exports = {Inmate: Inmate, Snitch: Snitch, Partner: Partner, Killer: Killer};
