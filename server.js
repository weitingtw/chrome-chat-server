const express = require("express");
var AsyncLock = require("async-lock");
var socket = require("socket.io");
var match_lock = new AsyncLock();

const app = express();
var server = app.listen(process.env.PORT || 3000);
var io = socket(server);

var awaiting_match_users = [];
var matching_map = {};
var name_map = {};

function removeElement(arr, element) {
  for (var i = 0; i < arr.length; i++) {
    if (arr[i] === element) {
      arr.splice(i, 1);
    }
  }
}

io.on("connection", socket => {
  console.log("made socket connection");
  console.log(socket.id);
  socket.emit("connected");

  match_lock
    .acquire("key", () => {
      if (awaiting_match_users.length >= 1) {
        matching_map[socket.id] = awaiting_match_users[0];
        matching_map[awaiting_match_users[0]] = socket.id;
        awaiting_match_users.shift();
        io.to(socket.id).emit("match");
        io.to(matching_map[socket.id]).emit("match");
      } else {
        awaiting_match_users.push(socket.id);
      }
    })
    .then(function() {
      console.log("Current Matching");
      console.log(matching_map);
      console.log("Awaiting");
      console.log(awaiting_match_users);
    });

  socket.on("join", data => {
    name_map[socket.id] = data.name;
  });

  socket.on("disconnecting", () => {
    socket.to(matching_map[socket.id]).emit("disconnected");
    socket.emit("disconnected");
    delete name_map[socket.id];
    delete name_map[matching_map[socket.id]];
    delete matching_map[matching_map[socket.id]];
    delete matching_map[socket.id];
    removeElement(awaiting_match_users, socket.id);
  });

  socket.on("chat", data => {
    socket.to(matching_map[socket.id]).emit("chat", {
      message: data.message,
      name: name_map[socket.id]
    });
  });
});
