const express = require('express');
const Booth = require('./Game/booth');
const Game = require('./Game/game')
const playerRole = require('./Game/players');

const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const users = {};
var g = null;


app.set('views', __dirname + '/../client/views')
app.set('view engine', 'ejs')

app.use(express.static(__dirname + '/../client'));
app.use(express.urlencoded({ extended: true }));

var rooms = { test: {users: new Map(), game: null}};
    

app.get('/', (req, res) => {

	res.render('index.ejs', { rooms: rooms})
})

app.post('/room', (req, res) => {
	if (rooms[req.body.room] != null) {
		return res.redirect('/')
	}
	rooms[req.body.room] = {users: new Map(), game: null}
	console.log(rooms)
	res.redirect(req.body.room)
	//send message saying new room was created
	io.emit('room-created', req.body.room)
})

app.get('/:room', (req, res) => {
	if(rooms[req.params.room] == null ||
	rooms[req.params.room].users.size == 10 ||
    rooms[req.params.room].game != null)	{
		return res.redirect('/')
	}
	res.render('room', { roomName: req.params.room})
})

 

//when a player connects to the server
io.on('connection', socket => {
	
 
	
	socket.on('new-user', (room, name) => {
		socket.join(room)
		rooms[room].users.set(socket.id, {_name: name, _role: "N/A", _points: "N/A"});
		socket.to(room).emit('user-connected', (room, name));
		io.to(socket.id).emit('set-up', (room, rooms[room].users.get(socket.id)))
		io.to(room).emit('names', createNameArray(rooms[room].users))
	})
	
	
	/*
	if(waitingPlayer) {
		io.emit('chat-message', 'Game Start');
		new PD(waitingPlayer, socket);
		waitingPlayer = null;
	}
	else {
		waitingPlayer = socket;
		waitingPlayer.emit('chat-message', 'Waiting for opponent.')
		}
	*/
	
	
	
	//when a player sends a message to the server
	socket.on('send-chat-message', (room, text) => {
		
		if(text.charAt(0) == "!"){
			command(text, room, socket)
		}
		else {
		//the server sends the message back to all other players
		socket.emit('chat-message', "You: " + text);
		socket.to(room).emit('chat-message', rooms[room].users.get(socket.id)._name + ": " + text);
		
		}
	});
	
	socket.on('booth', (room, booth) => {
		if(rooms[room].game != null && rooms[room].game._inmates.has(socket.id)){
			rooms[room].game.enterBooth(socket.id, booth[0], booth[1])
		} else{
			socket.emit('chat-message', 'no no no.');
		}
	})
	
	
	socket.on('vote', (room, voteId) => {
		if(rooms[room].game != null && rooms[room].game._inmates.has(socket.id)){
			rooms[room].game.sendVote(socket.id, voteId)
		}
	});
	
	
	
	socket.on('updatePlayerPoints', (room, info) => {
		rooms[room].game._players.get(socket.id).changePoints(info);
		io.to(socket.id).emit('set-up', (room, rooms[room].game._players.get(socket.id)))
	});
	
	socket.on('disconnect', () => {
		getUserRooms(socket).forEach(room => {
			socket.broadcast.emit('user-disconnected', rooms[room].users.get(socket.id)._name)
			rooms[room].users.delete(socket.id)
			if(rooms[room].game != null){
				if(rooms[room].game._inmates.has(socket.id)){
				rooms[room].game._inmates.get(socket.id).instaKill();
				rooms[room].game.deathCheck();
				rooms[room].game.makeNameArray();
				rooms[room].game.resetRound();
			} else if(rooms[room].game._warden == socket.id){
				resetGame(room);
				
				
		}
		
			}else{
			io.in(room).emit('names', createNameArray(rooms[room].users))
			}})
		
	});
	
	socket.on('reset-game', room => {
		rooms[room].game = null;
	//	rooms[room].users.set(socket.id, {_name: name, _role: "N/A", _points: "N/A"});
		for(var [socketID, userInfo] of rooms[room].users){
			let name = userInfo._name
			rooms[room].users.set(socketID, {_name: name, _role: "N/A", _points: "N/A"});
			io.to(socketID).emit('set-up', (room, {_name: name, _role: "N/A", _points: "N/A"}))
			
		}
		io.in(room).emit('show-booths', 0)
		io.in(room).emit('timer', -1)
		io.in(room).emit('names', createNameArray(rooms[room].users))
	});
});
 
function getUserRooms(socket) {
	return Object.entries(rooms).reduce((names, [name, room]) => {
	  if (room.users.has(socket.id)) names.push(name)
	  return names
	}, [])
}

function resetGame(room){
	rooms[room].game = null;
	//	rooms[room].users.set(socket.id, {_name: name, _role: "N/A", _points: "N/A"});
		for(var [socketID, userInfo] of rooms[room].users){
			let name = userInfo._name
			rooms[room].users.set(socketID, {_name: name, _role: "N/A", _points: "N/A"});
			io.to(socketID).emit('set-up', (room, {_name: name, _role: "N/A", _points: "N/A"}))
			io.in(room).emit('timer', -1)
		}
		io.in(room).emit('names', createNameArray(rooms[room].users))
}

server.on('error', (err) => {
	console.error('Server error:', err);
});
const PORT = process.env.PORT || 3000;


server.listen(PORT, () => {
	console.log(`PD started on ${PORT}`);
}); 

function createNameArray(users){
	var names = []
	for(user of users.values()){
		names.push(user._name)
	}
	return names;
}
  
function command(text, room, socket){
	var txt = text.split(" ");
	
	var cmd = txt[0]
	txt.splice(0, 1);
	txt = txt.map(x => Number(x))
	if(rooms[room].game == null && cmd == "!start"){
		rooms[room].game = new Game(room, io, rooms[room].users, socket.id);
		rooms[room].game.startRound()
	}else if(cmd == "!test") {
		socket.emit('timer', 9);
	}
	else if(rooms[room].game != null){
	
	switch(cmd){
		case "!select":
		
		if(rooms[room].game._selectingUser == socket.id) {
			if(txt.length != 0 && txt.every(x => !isNaN(x))) { 
			
			
		rooms[room].game._awaitingResponse.next(txt);
			} else {
				socket.emit('chat-message', 'please enter valid input')
			}
		} else {
			socket.emit('chat-message', 'you shut up.')
		}
		break;
		case "!stopTime":
		if(rooms[room].game._timer != null){
		clearTimeout(rooms[room].game._timer)
		rooms[room].game._timer = null;
		io.in(room).emit('timer', -1)
		}
		break;
		case "!restartTime":
		if(!isNaN(txt[0])){
		rooms[room].game._timer = setTimeout(()=> {rooms[room].game.timeUp()}, (txt[0] * 1000))
		io.in(room).emit('timer', txt[0])
		}
		break;
		case "!endRound":
		clearTimeout(rooms[room].game._timer);
		rooms[room].game.checkAllBooths();
		break;
		case "!escape":
		if(rooms[room].game._winners.includes(socket.id)){
			rooms[room].game._awaitingResponse.next(true)
		}
		case "!truth":
		if(rooms[room].game._truthRound == 1){
		rooms[room].game.truthOrDefaultReceiveVote(socket.id, "truth")
		}
		break;
		case "!pass":
		if(rooms[room].game._truthRound == 1){
		rooms[room].game.truthOrDefaultReceiveVote(socket.id, "normal")
		}
		break;
		
		
		default:
		socket.emit('chat-message', "unknown command")
	}
	}
}
