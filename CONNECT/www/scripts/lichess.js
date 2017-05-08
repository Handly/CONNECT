// This file implements the Lichess API

// Login to Lichess
function lichessLogin() {
    var xhttp = new XMLHttpRequest();
    var url = "http://en.lichess.org/login";
    var params = "username=" + $('#username').val() + "&password=" + $('#password').val();
    xhttp.open("POST", url, true);
    xhttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    // send the proper header information along with the request
    xhttp.setRequestHeader("Accept", "application/vnd.lichess.v1+json");
    xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
            $("#loginPanel").panel("close");
            $("#login-link").hide();
            $("#logout-btn").show();
            console.log(xhttp.responseText);
        }
    };
    xhttp.send(params);
}

// Logout from Lichess
function lichessLogout() {
    var xhttp = new XMLHttpRequest();
    var url = "http://en.lichess.org/logout";
    xhttp.open("GET", url, true);

    // send the proper header information along with the request
    xhttp.setRequestHeader("Accept", "application/vnd.lichess.v1+json");
    xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
            $("#login-link").show();
            $("#logout-btn").hide();
            console.log(xhttp.responseText);
        }
    };
    xhttp.send();
}

// Get Lichess account info including current games
// returns true if logged in, false if "unauthorized"
function getLichessUser() {
    var xhttp = new XMLHttpRequest();
    var url = "http://en.lichess.org/account/info/";
    var bustCache = '?' + new Date().getTime();
    xhttp.open("GET", url + bustCache, true);

    // send the proper header information along with the request
    xhttp.setRequestHeader("Accept", "application/vnd.lichess.v1+json");
    xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
            // status OK --> return true
            $("#login-link").hide();
            $("#logout-btn").show();
        }
        else if (this.readyState == 4 && this.status != 200) {
            // unauthorized --> return false
            $("#login-link").show();
            $("#logout-btn").hide();
        }
    };
    xhttp.send();

}

function createMachineGame() {
    console.log("game with machine requested");
}

function createOTBGame() {
    console.log("otb game requested");
}



pinger = null;

lastMove = null;

latestMove = null;

writer = null;

function gameConnect(fullID) {

    if (pinger == null) {

        pinger = "pinger not null now";

        window.currentGame = fullID;

        // ---------------- Store Game Info ----------------- //

        var xhttp = new XMLHttpRequest();
        var url = "http://en.lichess.org/" + currentGame;
        xhttp.open("GET", url, true);

        xhttp.setRequestHeader("Accept", "application/vnd.lichess.v1+json");
        xhttp.onreadystatechange = function () {
            if (this.readyState == 4 && this.status == 200) {
                gameInfo = JSON.parse(xhttp.responseText);
                startGame();
            }
        };
        xhttp.send();

        // -------------------------------------------------- //

        function startGame() {

            window.version = gameInfo.player.version;

            dests = gameInfo.possibleMoves;

            gameObject.player = gameInfo.game.player;
            gameObject.myColor = gameInfo.player.color;

            if ('clock' in gameInfo) {
                gameObject.timed = true;
                gameObject.timeStamp = Date.now();
                gameObject.bClock = gameInfo.clock.black;
                gameObject.wClock = gameInfo.clock.white;

                gameObject.clock = gameInfo.clock.running;

                updateClocks(init);

                window.decrementer = setInterval(function () { updateClocks() }, 100);

            }

            var baseUrl = gameInfo.url.socket; // obtained from game creation API (`url.socket`)
            clientId = Math.random().toString(36).substring(2); // created and stored by the client

            var socketUrl = 'ws://socket.en.lichess.org:9021' + baseUrl + '?sri=' + clientId + '&ran=--ranph--';

            window.awaitingAck = false;

            window.sentMove = null;

            window.socket = new WebSocket(socketUrl);

            socket.onopen = function () {

                window.pinger = setInterval(function () {

                    ping();

                }, 2000);

            };

            socket.onmessage = function (event) {


                console.log(event.data);

                var eventData = JSON.parse(event.data);

                if (eventData.hasOwnProperty("t")) {

                    if (eventData.t != "n") {
                        if (eventData.t == "b") {
                            eventData = eventData.d[0];

                        }
                        if (awaitingAck && eventData.t != "ack") {
                            console.log("resending move...");
                            sendMove();
                        }
                        else if (awaitingAck && eventData.t == "ack") {

                            awaitingAck = false;
                        }
                        if (eventData.t == "resync") {
                            console.log("resync message received!");
                            syncFEN();

                        }
                        else if (eventData.t == "move") {

                            gameObject.timeStamp = Date.now();

                            latestMove = eventData.d.uci;

                            board.position(eventData.d.fen);

                            dests = eventData.d.dests;

                            gameObject.player = (eventData.d.ply % 2 == 1) ? 'black' : 'white';

                            if ('clock' in eventData.d) {
                                gameObject.wClock = eventData.d.clock.white;
                                gameObject.bClock = eventData.d.clock.black;
                                updateClocks(true);
                                gameObject.clock = (eventData.d.ply > 1) ? true : false;
                            }
                        }
                        else if (eventData.t == "end") {
                            if (gameObject.clock) {
                                clearInterval(decrementer);
                                gameObject.clock = false;
                                clearInterval(writer);
                                latestMove = null;
                            }

                            if ('d' in eventData) {
                                document.getElementById("overTime").innerHTML = eventData.d;
                                document.getElementById("underTime").innerHTML = "wins";
                            }
                            else {
                                document.getElementById("overTime").innerHTML = "draw";
                                document.getElementById("underTime").innerHTML = "game";
                            }
                        }
                        if (eventData.hasOwnProperty("v")) {
                            version = eventData.v;
                        }
                        if (latestMove != null)
                            if (gameObject.player == gameObject.myColor) {

                                if(clearInterval(writer)); // make sure cleared before setting
                                writer = setInterval(lightLED, 250);

                                writeSource = squares.indexOf(latestMove.slice(0, 2));
                                writeTarget = squares.indexOf(latestMove.slice(2, 4));
                            }
                    }
                }
            };

            socket.onerror = function () {
                console.log('error occurred!');
            };

            socket.onclose = function (event) {
                clearInterval(pinger);
                pinger = null;
                if (gameObject.clock)
                    clearInterval(decrementer);
                console.log("socketClosed!");

            };

            try {
                syncFEN();
            }
            catch (err) {
            }

        }
    }
}

var blacks;
var whites;



function updateClocks(init) {

    if (gameObject.clock || init) {

        if (gameObject.player == "black" || init) {

            blacks = gameObject.bClock - Math.floor((Date.now() - gameObject.timeStamp) / 1000);
            if (blacks < 0)
                blacks = 0;
            bHours = Math.floor(blacks / 3600);
            if (bHours < 10)
                bHours = "0" + bHours;
            bMins = Math.floor(blacks % 3600 / 60);
            if (bMins < 10)
                bMins = "0" + bMins;
            bSecs = Math.floor(blacks % 60);
            if (bSecs < 10)
                bSecs = "0" + bSecs;
            whichClock = (gameObject.myColor == "white") ? "overTime" : "underTime";
            document.getElementById(whichClock).innerHTML = (bHours + ":" + bMins + ":" + bSecs);
        }

        if (gameObject.player == "white" || init) {

            whites = gameObject.wClock - Math.floor((Date.now() - gameObject.timeStamp) / 1000);
            if (whites < 0)
                whites = 0;
            wHours = Math.floor(whites / 3600);
            if (wHours < 10)
                wHours = "0" + wHours;
            wMins = Math.floor(whites % 3600 / 60);
            if (wMins < 10)
                wMins = "0" + wMins;
            wSecs = Math.floor(whites % 60);
            if (wSecs < 10)
                wSecs = "0" + wSecs;
            whichClock = (gameObject.myColor == "black") ? "overTime" : "underTime";
            document.getElementById(whichClock).innerHTML = (wHours + ":" + wMins + ":" + wSecs);
        }

    }

}


let dests = new Object();

var writeSource;
var writeTarget;

var squares = ["a1", "b1", "c1", "d1", "e1", "f1", "g1", "h1",
                "a2", "b2", "c2", "d2", "e2", "f2", "g2", "h2",
                "a3", "b3", "c3", "d3", "e3", "f3", "g3", "h3",
                "a4", "b4", "c4", "d4", "e4", "f4", "g4", "h4",
                "a5", "b5", "c5", "d5", "e5", "f5", "g5", "h5",
                "a6", "b6", "c6", "d6", "e6", "f6", "g6", "h6",
                "a7", "b7", "c7", "d7", "e7", "f7", "g7", "h7",
                "a8", "b8", "c8", "d8", "e8", "f8", "g8", "h8", ];

var data2 = new Uint8Array(1);

var lightLED = function () {
    if (data2[0] == writeSource)
        data2[0] = writeTarget;
    else
        data2[0] = writeSource;
    //console.log("I should be writing " + data2[0] + " to: " + device_id + " and service_id: " + service_id + " and with char_id: " + characteristic_id);

    ble.write(device_id, service_id, characteristic_id, data2.buffer);
}

function sendMove(source, target) {

    var move = {
        t: 'move',
        d: {
            from: source,
            to: target
        }
    };

    window.sentMove = source + target;

    sentMove = source + target;

    socket.send(JSON.stringify(move));
    console.log("move sent to lichess!");
    window.awaitingAck = true;



}

function syncFEN() {
    var xhttp = new XMLHttpRequest();
    var url = "http://en.lichess.org/" + currentGame;
    xhttp.open("GET", url, true);

    xhttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    // send the proper header information along with the request
    xhttp.setRequestHeader("Accept", "application/vnd.lichess.v1+json");
    xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
            var currentFEN = JSON.parse(xhttp.responseText).game.fen;
            console.log(currentFEN);
            board.position(currentFEN);
        }
    };
    xhttp.send();
}

function ping() {

    socket.send(JSON.stringify({
        t: 'p',
        v: version
    }));

    console.log(JSON.stringify({
        t: 'p',
        v: version
    }));

}
