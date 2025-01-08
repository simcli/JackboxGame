const socket = io();
let frontEndPlayers = {};
let roundCounter = 0;
let maxRounds = 5;
changeRound("lobby");

socket.on("connection", (socketId) => {
  console.log("a player is joining!!!");

  initializePlayer(socketId);
});

async function initializePlayer(socketId) {
  let username = await getUserName(socketId);
  await userJoined(socketId, username);
}

async function userJoined(socketId, username) {
  if (socketId && username) {
    let newPlayer = new Client(socketId, username, false);

    frontEndPlayers[socketId] = newPlayer;
    console.log("Player " + socketId + " joined " + username);
    socket.emit("join", newPlayer);
  } else {
    alert("Something went wrong");
  }
}

// use when you want to prompt user for username
async function getUserName(socketId) {
  return new Promise((resolve, reject) => {
    let username = "";
    var modalPopup = new bootstrap.Modal(
      document.getElementById("usernameModal"),
      { backdrop: "static", keyboard: false }
    );

    //Idk why this works but it does
    let thePlayer = Object.values(frontEndPlayers).find(
      (player) => player.id === socketId
    );
    let numPlayers = Object.keys(frontEndPlayers).length;
    if (thePlayer || numPlayers <= 0) {
      modalPopup.show();
    }

    document
      .querySelector("#usernameModalBtn")
      .addEventListener("click", async () => {
        username = document.querySelector("#recipient-name").value;
        if (username && username !== "") {
          modalPopup.hide();
          console.log(username);
          resolve(username);
        } else {
          reject(alert("Please enter a valid username"));
        }
      });
  });
}



function getMaxRounds() {
  return document.getElementById("roundSelect").value
}


socket.on("getMaxRounds", (number) => {
  maxRounds = number;
  console.log(maxRounds)
});

socket.on("clients", (clients) => {
  clearDots();

  frontEndPlayers = {};

  // Populate the frontEndPlayers dictionary with the new clients
  for (let clientId in clients) {
    let newPlayer = new Client(
      clients[clientId].id,
      clients[clientId].username
    );
    frontEndPlayers[clientId] = newPlayer;
  }

  console.log(frontEndPlayers);
  populateUsernames(clients);
});

function populateUsernames(clients) {
  let numClients = Object.keys(clients).length;

  if (numClients > 0) {
    //light up the red dot green
    const dots = document.querySelectorAll(".dot");

    for (let i = 0; i < numClients; i++) {
      dots[i].classList.add("bg-success");
    }

    //add the username
    document.querySelector("#usernames").innerHTML = "";
    for (let client in clients) {
      document.querySelector(
        "#usernames"
      ).innerHTML += `\n${clients[client].username}`;
    }
  }
}

socket.on("hostButton", (msg) => {
  if (msg) {
    const button = document.querySelector("#btnStartGame");
    button.classList.remove("d-none");
    button.textContent = msg;
  }
});

//chat button click event

document.querySelector("#btnSendChat").addEventListener("click", sendChat);

function sendChat() {
  const msg = document.querySelector("#chatInput").value;
  if (msg.trim() !== "") {
    // Send chat message to the server
    socket.emit("chatMessage", msg);
    // Clear the chat input field
    document.querySelector("#chatInput").value = "";
  }
}

socket.on("chatMessage", (msg) => {
  const chatbox = document.querySelector(".chat");
  chatbox.innerHTML += "\n" + msg + "\n";
});

//Start Countdown
document
  .querySelector("#btnStartGame")
  .addEventListener("click", startPromptRound);

//SEND BLANK BUTTON
function startPromptRound() {
  socket.emit("promptRound");
  socket.emit("maxRounds", getMaxRounds());
}

document.querySelector("#btnSendBlank").addEventListener("click", sendBlank);

//SUBMIT PROMPT BUTTON

document
  .querySelector("#btnSubmitPrompt")
  .addEventListener("click", submitPrompt);

function submitPrompt() {
  const prompt = document.querySelector("#blankInput").value;

  if (prompt.trim() !== "" && prompt.trim().includes("_____")) {
    document.querySelector("#blankInput").value = "";
    socket.emit("submitPrompt", prompt);
  } else {
    alert("Please enter a valid prompt with the blank space.");
  }
}

//Event listener for promptTable

socket.on("disconnect", (socket) => {
  //console.log("Player left " + socket.id);
});

socket.on("removePlayer", (socketId) => {
  console.log("Removing player: " + socketId);
  delete frontEndPlayers[socketId];
});

socket.on("disconnecting", (socket) => {
  console.log("Player disconnecting " + socket.id);
});

//HELPER FUNCTIONS

function clearDots() {
  const dots = document.querySelectorAll(".dot");
  dots.forEach((dot) => dot.classList.remove("bg-success"));
}

//happens when start game button is clicked
function start_countdown() {
  var reverse_counter = 45;
  var downloadTimer = setInterval(function () {
    document.getElementById("pbar").value = 45 - --reverse_counter;

    document.getElementById("counting").innerHTML = reverse_counter;
    //CHANGE THIS TO 0 if you want to stop changing the round
    if (reverse_counter === 0) {
      //Must send socket request HERE
      console.log("Emitting AnswersRound event");
      socket.emit("answersRound");

      clearInterval(downloadTimer);

      //socket.emit("")
    }
  }, 1000);
}

function sendBlank() {
  const blankInput = document.querySelector("#blankInput");
  blankInput.value += "_____";
}

function fillPromptBox() {
  const theTable = document.querySelector("#promptTable");

  //receive prompts from the server and fill the table
  socket.on("prompts", (prompts) => {
    let html = "";
    prompts.forEach((prompt) => {
      html += "<tr>";
      html += "<td>" + prompt + "</td>";
      html += "</tr>";
    });
    theTable.innerHTML = html;
  });
}

//select prompt from the table

document
  .querySelector("#promptTable")
  .addEventListener("click", function (event) {
    if (event.target.innerHTML !== "") {
      const prompt = event.target.innerHTML;
      document.querySelector("#promptSelection").innerHTML = prompt;
    }
  });

// submit answer for the prompt

document
  .querySelector("#btnSubmitAnswer")
  .addEventListener("click", submitAnswer);

//submit answer for the prompt
// Must submit the answer plus prompt selected
function submitAnswer() {
  const answer = document.querySelector("#answerInput").value;
  const theSelection = document.querySelector("#promptSelection");

  if (answer.trim() !== "") {
    document.querySelector("#answerInput").value = "";

    let formattedAnswer = document
      .querySelector("#promptSelection")
      .innerHTML.replace("_____", " " + answer + " ");

    theSelection.innerHTML = formattedAnswer;

    socket.emit("submitAnswer", formattedAnswer, socket.id);

    disableAnswerRound();
  } else {
    alert("Please enter an answer.");
  }
}

//setup send votes

document.querySelector("#voteBox").addEventListener("click", submitVote);

function submitVote(event) {
  //send off which client got the vote
  //data attribute on the voting boxes
  let votingBox = event.target.closest(".blockquote");
  let voteBox = document.querySelector("#voteBox");

  if (votingBox) {
    voteBox.classList.add("d-none");
    let votedClientId = votingBox.dataset.socketId;
    socket.emit("submitVote", votedClientId);
  }
}
socket.on("receiveVotes", (votesLeft) => {
  updateVoteCounter(votesLeft);
});

function updateVoteCounter(votes) {
  const numVotes = document.querySelector("#numVotes");
  numVotes.innerHTML = votes;
}

//receive a pair of answers after voting has completed
//and when the answerRound is completed
setUpReceiveAnswers();
function setUpReceiveAnswers() {
  //maybe send the whole client here?
  socket.on("selectedClients", (clients) => {
    document.querySelector("#voteBox").classList.remove("d-none");
    hideVotingBoxes();
    displayAnswers(clients);
  });
}

function displayAnswers(clients) {
  let counter = 1;

  clients.forEach((client) => {
    let votingBox = document.querySelector(`#votingBox${counter}`);

    counter++;
    votingBox.dataset.socketId = client.id;
    votingBox.innerHTML = client.answer;
    votingBox.classList.remove("d-none");
  });
}

function hideVotingBoxes() {
  document.querySelector("#votingBox1").classList.add("d-none");
  document.querySelector("#votingBox2").classList.add("d-none");
  document.querySelector("#votingBox3").classList.add("d-none");
}

// setup the correct round

// Ensure this is only called once, perhaps during initial connection setup

function setUpChangeRoundListener() {
  socket.on("changeRound", (round) => {
    console.log("Changing round to: " + round);

    changeRound(round);
  });
}

// Call this function once when setting up the socket connection
setUpChangeRoundListener();

function changeRound(elementId) {
  switch (elementId) {
    case "lobby":
      document.querySelector("#lobby").classList.remove("d-none");
      document.querySelector("#promptRound").classList.add("d-none");
      document.querySelector("#answersRound").classList.add("d-none");
      document.querySelector("#votingRound").classList.add("d-none");
      document.querySelector("#scoreRound").classList.add("d-none");

      break;
    case "promptRound":
      document.querySelector("#lobby").classList.add("d-none");
      document.querySelector("#promptRound").classList.remove("d-none");
      document.querySelector("#answersRound").classList.add("d-none");
      document.querySelector("#votingRound").classList.add("d-none");
      document.querySelector("#scoreRound").classList.add("d-none");

      start_countdown();
      break;
    case "answersRound":
      document.querySelector("#lobby").classList.add("d-none");
      document.querySelector("#promptRound").classList.add("d-none");
      document.querySelector("#answersRound").classList.remove("d-none");
      document.querySelector("#votingRound").classList.add("d-none");
      document.querySelector("#scoreRound").classList.add("d-none");
      enableAnswerRound();
      fillPromptBox();

      break;
    case "votingRound":
      document.querySelector("#lobby").classList.add("d-none");
      document.querySelector("#promptRound").classList.add("d-none");
      document.querySelector("#answersRound").classList.add("d-none");
      document.querySelector("#votingRound").classList.remove("d-none");
      document.querySelector("#scoreRound").classList.add("d-none");

      break;
    case "scoreRound":
      document.querySelector("#lobby").classList.add("d-none");
      document.querySelector("#promptRound").classList.add("d-none");
      document.querySelector("#answersRound").classList.add("d-none");
      document.querySelector("#votingRound").classList.add("d-none");
      document.querySelector("#scoreRound").classList.remove("d-none");

      break;
    default:
      break;
  }
}

setupScoreSocket();
function setupScoreSocket() {
  socket.on("allTheClients", (clients) => {
    displayScore(clients);

    startScoreTimer();
  });
}

// Display the scoreboard

function displayScore(clients) {
  let html = "";
  html += "<th>Number of votes</th><th></th>";

  for (const key in clients) {
    html += "<tr>";
    html += `<td>${clients[key].username}</td>`;
    html += `<td>${clients[key].votes}</td>`;
    html += "</tr>";
  }

  document.querySelector("#scoreTable").innerHTML = html;
}

// Timer for the scoring round
// when this time is finished it should go to the prompt round
// unless the specified round count is up then reset game and go back to lobby
function startScoreTimer() {
  var reverse_counter = 10;
  var downloadTimer = setInterval(function () {
    document.getElementById("scorepbar").value = 10 - --reverse_counter;

    //CHANGE THIS TO 0 if you want to stop changing the round
    if (reverse_counter === 0) {
      //Must send socket request HERE
      console.log("Timer finished");

      clearInterval(downloadTimer);
      

      if (roundCounter === maxRounds) {
        //reset game and go back to lobby
        roundCounter = 0;
        socket.emit("lobby");
      } else {
        roundCounter++;
        socket.emit("promptRound");
      }
    }
  }, 1000);
}

// Disable the answer round
function disableAnswerRound() {
  document.querySelector("#promptTable").classList.add("d-none");
  document.querySelector("#answerInput").disabled = true;
  document.querySelector("#btnSubmitAnswer").disabled = true;
}

function enableAnswerRound() {
  document.querySelector("#promptTable").classList.remove("d-none");
  document.querySelector("#answerInput").disabled = false;
  document.querySelector("#btnSubmitAnswer").disabled = false;
}
