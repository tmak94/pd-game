const sock = io()
const messageContainer = document.getElementById('message-container')
const roomContainer = document.getElementById('room-container')
const messageForm = document.getElementById('send-container')
const messageInput = document.getElementById('message-input')
const nameBox = document.getElementById('name')
const roleBox = document.getElementById('role')
const pointBox = document.getElementById('points')
const timerBox = document.getElementById('timer')
const nameList = document.getElementById('user-list')
const sides = []
for(var s of document.getElementsByClassName('side')){
	sides.push(s.id)
}
var timer = null;
var seconds;

if (messageForm != null) {
	var name;
	while(name == undefined || name == "" || name.length > 6 || /[^a-zA-Z]/.test(name)){
	name = prompt('Please enter a name (limit 6 characters, only use letters)')
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

sock.on('names', nameArray => {
	nameList.innerHTML = ""
	nameList.appendChild(makeNameList(nameArray))
})
sock.on('show-in-booth', (sideID, names) => {
	nameInBooth(sideID, names)
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

sock.on('show-booths', number => {
	showBooths(number);
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
	
	messageContainer.scrollTop = messageContainer.scrollHeight
	
}

function nameInBooth(id, names){
	var side = document.getElementById(id)
	side.innerText = "";
	side.innerText = names;
}

const addButtonListeners = () => {
  ['ally', 'betray'].forEach((id) => {
    const button = document.getElementById(id);
    button.addEventListener('click', () => {
      sock.emit('vote', roomName, id);
    });
  });
};

function showBooths(number){
	resetBoothNames();
	const booths = document.getElementsByClassName("booth");
	for(var booth of booths){
		booth.style.visibility = "hidden"
	}
	if(number > 0){
	for(var i = 0; i < number; i++){
		booths[i].style.visibility = "visible"
	}
	}
}


const addBoothListeners = () => {
	
	sides.forEach((id) => {
		var boothSide = document.getElementById(id)
		boothSide.addEventListener('click', () => {
			
			sock.emit('booth', roomName, [id.charAt(2), id.charAt(4)].map(x => parseInt(x)));
		})
	})
}

function makeNameList(userArray){
	var list = document.createElement('ul')
	userArray.forEach(user => {
		var item = document.createElement('li')
		if(user.startsWith("#")){
			let color = user.slice(0, 7)
			item.style.color = color
			user = user.substring(7)
		}
		item.appendChild(document.createTextNode(user))
		list.appendChild(item)
	})
	return list;
}

addButtonListeners();
addBoothListeners();

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

function resetBoothNames(){
	const sides = document.getElementsByClassName("side");
	for(var side of sides){
      if(side.id.slice(-1) == "0"){
		  side.innerText = "A"
	  }	else{
		  side.innerText = "B"
	  }
	}
}