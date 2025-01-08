const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { pingInterval: 2000, pingTimeout: 5000 });
const port = 3000;

app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

let clients = {};
let prompts = [];
let numClients = 0;
let voteCounter = 0;

io.on("connection", (socket) => {
  io.emit("connection", socket.id);

  socket.on("join", (client) => {
    if (client !== null) {
      console.log(clients);
      try {
        //if nobody is a host pick a host

        const noHost = Object.values(clients).every(
          (client) => client.host === false
        );
        if (noHost) {
          client.host = true;
        }

        client.id = socket.id;
        clients[socket.id] = client;
        io.emit("clients", clients);

        // Update the numClients variable
        numClients = Object.keys(clients).length;

        // select the host
        const hostClient = Object.values(clients).find((c) => c.host);
        if (hostClient) {
          //emit to the host that they are the host
          io.to(hostClient.id).emit("hostButton", "Start Game");
        }
        console.log("New client connected " + socket.id);
        console.log("numCLients: " + numClients);
      } catch (e) {
        console.error("Error parsing client data: ", e);
        return;
      }
    }
  });

  socket.on("maxRounds", (rounds) => {
    io.emit("getMaxRounds", rounds);
  });

  socket.on("chatMessage", (msg) => {
    io.emit("chatMessage", msg);
  });

  socket.on("promptRound", () => {
    io.emit("changeRound", "promptRound");
  });

  socket.on("answersRound", () => {
    io.emit("changeRound", "answersRound");
    //emit the selection to each player

    // Shuffle the prompts array
    for (let i = prompts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [prompts[i], prompts[j]] = [prompts[j], prompts[i]];
    }

    // Distribute prompts to clients in a round-robin fashion
    const promptsPerPlayer = Math.floor(prompts.length / numClients);
    const clientIds = Object.keys(clients);
    let startIndex = 0;
    for (let i = 0; i < clientIds.length; i++) {
      const clientId = clientIds[i];
      const endIndex = startIndex + promptsPerPlayer;
      const clientPrompts = prompts.slice(startIndex, endIndex);
      io.to(clientId).emit("prompts", clientPrompts);
      startIndex = endIndex;
    }

    console.log("Prompts per player: " + promptsPerPlayer);
    console.log("Remaining prompts: " + prompts);
  });

  // Handle prompts submission
  socket.on("submitPrompt", (prompt) => {
    if (prompt !== undefined) {
      prompts.push(prompt);
      console.log("All the prompts " + prompts);
    }
  });

  //Handle answer submission
  socket.on("submitAnswer", (answer, socketId) => {
    if (answer !== undefined) {
      clients[socketId].answer = answer.trim();

      //check if every client has an answer
      const checkAnswers = Object.values(clients).every(
        (client) => client.answer !== undefined && client.answer !== ""
      );
      console.log(clients);
      console.log("Check Answers ???=== " + checkAnswers);
      if (checkAnswers) {
        // every client has an answer at this point
        io.emit("changeRound", "votingRound");
        voteCounter = numClients;
        io.emit("receiveVotes", voteCounter);

        //this event needs to be emitted when i know the voting round has started
        io.emit("selectedClients", emitCorrectClients());
      }
    }
  });

  //i need to continue the voting round until all players have played then show the scoring round

  // server side
  //after all answers have been submitted changeRound receiveVotes and selectedClients are emitted

  //client side
  //function setUpReceiveAnswers() {


  //what are correct clients?
  //why are they being emitted?


  function emitCorrectClients() {
    const clientsWhoHaventPlayed = Object.values(clients).filter(
      (client) => client.answerSent === false
    );
    const clientsToBeEmitted = [];
    //console.log(clients);
    //console.log(clientsWhoHaventPlayed);
    //if theres 3 left send all three otherwise send 2

    if (clientsWhoHaventPlayed.length <= 0) {
      // all clients have sent an answer
      return "No Clients Available";
    }
    //clientsWhoHaventPlayed cannot be 1
    if (clientsWhoHaventPlayed.length == 1) {
      clients[clientsWhoHaventPlayed[0].id].answerSent = true;
      clientsToBeEmitted.push(clientsWhoHaventPlayed[0]);
      return "Cannot play 1 player games";
    }

    if (clientsWhoHaventPlayed.length === 3) {
      //emit the next 3 clients here
      for (let i = 0; i < 3; i++) {
        clients[clientsWhoHaventPlayed[i].id].answerSent = true;
        clientsToBeEmitted.push(clientsWhoHaventPlayed[i]);
      }
    } else {
      // emit the next two clients here
      for (let i = 0; i < 2; i++) {
        clients[clientsWhoHaventPlayed[i].id].answerSent = true;
        clientsToBeEmitted.push(clientsWhoHaventPlayed[i]);
      }
    }

    return clientsToBeEmitted;
  }

  //Need to know who was voted for
  socket.on("submitVote", (votedClient) => {
    //find the client whos answer it was and +1 votes
    console.log(voteCounter);
    clients[votedClient].votes++;

    voteCounter--;
    io.emit("receiveVotes", voteCounter);

    if (voteCounter === 0) {
      console.log("All votes have been cast");
      console.log(clients);
      //score round starts here

      let correctClients = emitCorrectClients();

      if (correctClients === "No Clients Available") {
        console.log("All clients have played " + clients);
        io.emit("changeRound", "scoreRound");
        io.emit("allTheClients", clients);

        for (const key in clients) {
          clients[key].answer = "";
          clients[key].answerSent = false;
        }
        prompts = [];
      } else {
        io.emit("changeRound", "votingRound");
        io.emit("selectedClients", correctClients);
        voteCounter = numClients;
      }
    }
  });

  //I NEED THE NUMBER OF VOTES LEFT
  //votes is the remaining number of votes

  //answers is the ??
  //AND I NEED THE ANSWERS FOR EACH ROUND

  // Handle disconnect and pick a new host if the host left
  socket.on("disconnect", (reason) => {
    //check if theres any clients to disconnect
    if (numClients > 0) {
      console.log("Client " + clients[socket.id] + " disconnected " + reason);

      // then check if the client that left is the host
      if (clients !== undefined) {
        //change the host
        const remainingClients = Object.values(clients).filter((c) => !c.host);
        if (remainingClients.length > 0) {
          remainingClients[0].host = true;
          io.to(remainingClients[0].id).emit(
            "hostMessage",
            "A player left, the new host is " + remainingClients[0].username
          );
        } else {
          console.log("No more players left");
        }
      }
      //finally remove the old players
      io.emit("removePlayer", socket.id);
      delete clients[socket.id];
    }

    io.emit("clients", clients);
  });
});

//backend ticker
// setInterval(() => {
//   if (numClients > 0) {
//     io.emit("clients", clients);
//   }
// }, 1000); // 1 second interval

//connection errors when a connection is abnormaly closed
io.engine.on("connection_error", (err) => {
  console.log(err.req); // the request object
  console.log(err.code); // the error code, for example 1
  console.log(err.message); // the error message, for example "Session ID unknown"
  console.log(err.context); // some additional error context
});

httpServer.listen(port);

console.log("listening on port " + port);
