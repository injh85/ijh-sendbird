const express = require("express");
const ejs = require("ejs");
const crypto = require('crypto');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const app = express();
//app.use(bodyParser.json()); // support json encoded bodies
//app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies
app.use(bodyParser.text({ type: 'json' }));

app.use(express.static("public"));
app.use(express.json());
app.set('view engine', 'ejs');

// stored in a .env file
const SENDBIRD_MASTER_API_TOKEN = process.env.SENDBIRD_MASTER_API_TOKEN;
const SENDBIRD_SEC_API_TOKEN = process.env.SENDBIRD_SEC_API_TOKEN;
const SENDBIRD_APP_ID = process.env.SENDBIRD_APP_ID;

//  -------- route to web pages --------
app.get("/", (request, response) => {
  
  response.render(__dirname + '/src/pages/index', {
    sendBirdAppId: SENDBIRD_APP_ID
  });
});

//  -------- api invocation  --------
// ref: https://www.npmjs.com/package/node-fetch
const sendMsg = (params) => {
  //params.channelUrl = encodeURIComponent(params.channelUrl);
  
  let url = 'https://api-' + SENDBIRD_APP_ID + '.sendbird.com/v3/' + params.channelType + '/' + params.channelUrl + '/messages';
  
  return new Promise(function (resolve, reject){
    // ref: https://www.npmjs.com/package/node-fetch
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf8',
        'Api-Token': SENDBIRD_SEC_API_TOKEN
      },
      body: JSON.stringify({
        "message_type": params.msgType,
        "message": params.msg,
        "send_push": params.send_push,
        "data": params.data,
        "sorted_metaarray": params.sorted_metaarray
      })
    }).then(resp => {
      console.log(resp);
      resolve(resp.json());
    }).catch(err => {
      console.log(err);
      reject(err);
    });
  });
}

// -------- route to api  --------
// ref: https://sendbird.com/docs/chat/v3/platform-api/guides/webhooks
app.post("/webhook", async (request, response) => {  
  console.log("START POST /webhook START");
  console.log("signature received: " + request.get('x-sendbird-signature'));
  console.log(request.body);
  
  let body = request.body;
  const signature = request.get('x-sendbird-signature');
  const hash = crypto
        .createHmac('sha256', SENDBIRD_MASTER_API_TOKEN)
        //.update(JSON.stringify(body))
        .update(body)
        .digest('hex');

  console.log("my hash: " + hash);
  
  // Check if the value of the 'x-sendbird-signature' request header is the same as the comparison value you've created.
  if (signature == hash) {
    console.log('signature matched');
    
    body = JSON.parse(body);
    
    if (body.category == 'group_channel:create') {
      console.log('group_channel:create');
      
      // send an admin msg to the channel
      // ref: https://sendbird.com/docs/chat/v3/platform-api/guides/messages#3-send-a-message
      let channelName = body.channel.name;
      //let inviter = body.inviter.nickname;
      
      console.log('send admin message to ' + channelName);
      
      let promise = await sendMsg({
        channelType: 'group_channels', 
        channelUrl: body.channel.channel_url,
        msgType: 'ADMM',
        //msg: 'Welcome to ' + channelName + '. ' + inviter + ' invites you to be part of the inner circle group.'
        msg: '"The way to get started is to quit talking and begin doing." - Walt Disney',
        data: JSON.stringify({
          "font-size": "20px",
          "color": "grey",
          "font-style": "italic"
        }),
        send_push: true,
        sorted_metaarray: [
          {
            "key": "design",
            "value": [1, 2, 3]
          }
        ]
      });
    }
    response.sendStatus(200);
    
  } else {
    console.log('signature unmatched');
    response.sendStatus(401);    
  }
  
  console.log("END POST /webhook END");
  
});

// listen for requests :)
const listener = app.listen(process.env.PORT, () => {
  console.log("Your app is listening on port " + listener.address().port);
});