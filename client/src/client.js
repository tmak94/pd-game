const sock = io()
const messageContainer = document.getElementById('message-container')
const roomContainer = document.getElementById('room-container')
const messageForm = document.getElementById('send-container')
const messageInput = document.getElementById('message-input')
const nameBox = document.getElementById('name')
const roleBox = document.getElementById('role')
const pointBox = document.getElementById('points')
const timerBox = document.getElementById('timer')
var timer = null;
var seconds;

if (messageForm != null) {
	var name;
	while(name == undefined || name == ""){
	name = prompt('What is your name?')
	}
    sock.emit('new-user', roomName, name)

    messageForm.addEventListener('submit', e => {
	  e.preventDefault()
	  const message = messageInput.value
	  sock.emit('send-chat-message', roomName, message)
	  messageInput.value = ''
})
}

sock.on('room-created', room => {
	const roomElement = document.createElement('div')
	roomElement.innerText = room
	const roomLink = document.createElement('a')
	roomLink.href = `/${room}`
	roomLink.innerText = 'join'
	roomContainer.append(roomElement)
	roomContainer.append(roomLink)
})

sock.on('user-prompt', room => {
	const test = prompt('do a thing');
	sock.emit('send-chat-message', room, test)
})

sock.on('chat-message', data => {
	appendMessage(data)
})

sock.on('user-connected', username => {
	appendMessage(`${username} has connected`);
})

sock.on('set-up', userData => {
	console.log(userData)
	nameBox.innerText = userData._name;
	roleBox.innerText = userData._role;
	pointBox.innerText = userData._points;
})

sock.on('user-disconnected', user => {
	appendMessage(`${user} has disconnected`)
})


sock.on('timer', time => {
	seconds = time;
	if(timer != null){
		clearInterval(timer)
	}
	timer = setInterval(runTimer, 1000)
})

sock.on('game-over', room => {
	sock.emit('reset-game', room);
})



/*
sock.on('relay', info => {
	sock.emit(info[0], info[1], info[2])
})
*/

function appendMessage(message) {
	const messageElement = document.createElement('div')
	messageElement.innerText = message
	messageContainer.append(messageElement)
}

const addButtonListeners = () => {
  ['ally', 'betray'].forEach((id) => {
    const button = document.getElementById(id);
    button.addEventListener('click', () => {
      sock.emit('vote', roomName, id);
    });
  });
};

addButtonListeners();

function runTimer(){
	timerBox.innerText = `${seconds}`
	
	if(seconds < 1){
		clearInterval(timer)
		seconds = 0
		timerBox.innerText = "Standby"

	}else{
	seconds--;
	}
}