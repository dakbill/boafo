var express = require('express');
var session = require('express-session');
var bodyParser = require('body-parser');
var requests = require('request');

var MongoClient = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;
var NumberLong = require('mongodb').Long;
// var mongo_url = "mongodb://localhost:27017/boafo";
var mongo_url = "mongodb://admin:admin@ds013881.mlab.com:13881/reverse_auction";

var googleMapsClient = require('@google/maps').createClient({
    key: 'AIzaSyBC5jHxodOaUvl0YfsXilCFxexttQO8K3w'
});

var FACEBOOK_ACCESS_TOKEN = 'EAATuxYTSuxUBAES2nZAXB5ADmDtGDX5axHUrWqtV2bBVjOxBvOIhtCgccTHEBJIXSYqieZBXk99Q75qxA0dYy6vR7nmvkijMw9GW89OFZCPydCIhRqXIIRQdp3LavrZCd73NGOjQHrxKi62crI924CobbTj95zQme4ZAztU6IKQZDZD';
var FACEBOOK_PAGE_ID = '843149412490388';

var app = express();
var http = require('http').Server(app);

var server_port = process.env.OPENSHIFT_NODEJS_PORT || 3000;
var server_ip_address = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';



app.set('port', server_port);
app.set('ip', server_ip_address);
app.set('view engine', 'ejs');

app.use(express.static(__dirname + '/static'));
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json({}));
app.use(session({
    secret: 'boafoSecret',
    cookie: { maxAge: 60 * 60 * 1000 },
    resave: true,
    saveUninitialized: true
}));



var Utils = {
    getChecksum:function(text){
        var hash = 0, i, chr, len;
        if (text.length === 0) return hash;
        for (i = 0, len = text.length; i < len; i++) {
            chr   = text.charCodeAt(i);
            hash  = ((hash << 5) - hash) + chr;
            hash |= 0; // Convert to 32bit integer
        }
        return hash;
    },getFirstName:function(name){
        return name.split(/\s+/)[0];
    },base64Encode:function(text){
        return new Buffer(text).toString('base64');
    },base64Decode:function (text) {
        return new Buffer(text, 'base64').toString();
    },encodeUrlToQueryParameter:function(url){
        return url.replace(/:/g,'%3A').replace(/\//g,'%2F').replace(/\?/g,'%3F').replace(/&/g,'%26').replace(/#/g,'%23');
    }
};

app.locals.Utils = Utils;

app.use(function (req, res, next) {
    if(req.path.indexOf('api') > -1){
        res.header('Access-Control-Allow-Origin','*');
        res.header('Access-Control-Allow-Methods','DELETE,GET,POST,PUT,OPTIONS,HEAD');
        res.header("Access-Control-Allow-Headers", "X-Requested-With, Content-Type");
    }
    next();
});

var googleMapsClient = require('@google/maps').createClient({
    key: 'AIzaSyBC5jHxodOaUvl0YfsXilCFxexttQO8K3w'
});

var FACEBOOK_ACCESS_TOKEN = 'EAATuxYTSuxUBAES2nZAXB5ADmDtGDX5axHUrWqtV2bBVjOxBvOIhtCgccTHEBJIXSYqieZBXk99Q75qxA0dYy6vR7nmvkijMw9GW89OFZCPydCIhRqXIIRQdp3LavrZCd73NGOjQHrxKi62crI924CobbTj95zQme4ZAztU6IKQZDZD';
var FACEBOOK_PAGE_ID = '843149412490388';

function distanceApart(latlng1,latlng2) {
    var distance = Math.sqrt(Math.pow(Number(latlng1.lat) - Number(latlng2.lat),2) + Math.pow(Number(latlng1.long) - Number(latlng2.long),2));
    return distance;
}


function sendMarkSeen(recipientId) {
    requests({
        uri:`https://graph.facebook.com/v2.6/me/messages?access_token=${FACEBOOK_ACCESS_TOKEN}`,
        method:'POST',
        json:{
            recipient: {
                id: recipientId
            },
            sender_action: 'mark_seen'
        }
    },function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var jsonResponse = body;
            console.log(jsonResponse);
        }else{
            console.log('statusCode',response.statusCode);
            console.log('error',error);
        }
    });
}


function sendMessage(recipientId,message,db) {

    requests({
        uri:`https://graph.facebook.com/v2.6/me/messages?access_token=${FACEBOOK_ACCESS_TOKEN}`,
        method:'POST',
        json:{
            recipient: {
                id: recipientId
            },
            message: message
        }
    },function (error, response, body) {
        if (!error && response.statusCode == 200) {
            console.log(body);
            var now = new Date().getTime();
            db.collection('ChatMessage').insertOne({
                senderId:FACEBOOK_PAGE_ID,
                recipientId:recipientId,
                message:(typeof message == 'string'?message:JSON.stringify(message)),
                _created:NumberLong(now),
                _modified:NumberLong(now)
            },function (err, doc) {
                db.close();
            });
            var jsonResponse = body;
            console.log(jsonResponse);
        }else{
            console.log('response',body);
            console.log('error',error);
        }
    });
}

function getUserProfile(userId,callback) {
    requests({
        uri:`https://graph.facebook.com/v2.6/${userId}`,
        method:'GET',
        headers:{
            'Content-Type':'application/json'
        },
        qs:{
            access_token : FACEBOOK_ACCESS_TOKEN,
            fields:'first_name,last_name,profile_pic,locale,gender,timezone'
        }
    },function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var user = JSON.parse(body);
            callback(user)
        }else{
            console.log('error',error);
            callback(error);
        }
    });
}

function parseMessage(recipientId,text,callback) {
    requests({
        uri:'https://api.api.ai/v1/query',
        method:'GET',
        headers:{
            'Content-Type':'application/json',
            'Authorization':`Bearer 8afd513215734a9ab5d03b3c9e324dd8`
        },
        qs:{
            lang : true,
            query : text,
            sessionId : recipientId
        }
    },function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var jsonResponse = JSON.parse(body);
            callback(jsonResponse)
        }else{
            console.log('error',error);
            callback(error);
        }
    });
}

app.get('/api/ping',function (req, res) {
    res.json({code:0,message:'pong'});
});

app.get('/api/bot/boafo',function(req,res){
    var token = req.query['hub.verify_token'];
    var challenge = req.query['hub.challenge'];

    if ('boafo_bot' === token) {
        res.send(challenge);
    }
});

app.post('/api/bot/boafo',function(req,res){
    var senderId = req.body.entry[0].messaging[0].sender.id;
    var text = ((req.body.entry[0].messaging[0].message || {}).quick_reply || {}).payload || (req.body.entry[0].messaging[0].message || {}).text || (req.body.entry[0].messaging[0].postback || {}).payload;

    (function (recipientId,text) {
        sendMarkSeen(recipientId);
    })(senderId,text);

    MongoClient.connect(mongo_url,function(err,db){
        var now = new Date().getTime();
        db.collection('ChatMessage').insertOne({
            senderId:senderId,
            recipientId:FACEBOOK_PAGE_ID,
            message:text,
            _created:NumberLong(now),
            _modified:NumberLong(now)
        },function(err,doc){
            parseMessage(senderId,text,function (components) {
                if(!!components && !!(components.result.metadata || {}).intentName && (components.result.metadata || {}).intentName.indexOf('boafo.emergency') > -1){
                    var locationRequest = function (recipientId,db) {
                        sendMessage(recipientId,{
                            text:`var me get you nearby help \u{1F3C3} . Send or Type in your location`,
                            quick_replies:[
                                {content_type:"location"}
                            ]
                        },db);
                    };
                    var situationRequest = function (recipientId,db) {
                        var baseUrl = ((req.get('host').indexOf('heroku') > -1 ?'https':'http')  + '://' + req.get('host'));
                        sendMessage(recipientId,{
                            text:'What\'s your emergency?',
                            quick_replies:[
                                {content_type:'text',title:'Police',payload:'help me call the police',image_url:`${baseUrl}/images/police-icon.png`},
                                {content_type:'text',title:'Fire',payload:'help me call the fireservice',image_url:`${baseUrl}/images/fire-truck-icon.png`},
                                {content_type:'text',title:'Ambulance',payload:'help me call an ambulance',image_url:`${baseUrl}/images/ambulance-icon.png`},
                                {content_type:'text',title:'Disaster',payload:'help me call the disaster management',image_url:`${baseUrl}/images/disaster-icon.png`}
                            ]
                        },db);
                    };
                    if(!!components.result.parameters && (!!components.result.parameters.policeSituation || !!components.result.parameters.fireSituation || !!components.result.parameters.ambulanceSituation || !!components.result.parameters.disasterSituation)){
                        var now = new Date().getTime();
                        var properties = components.result.parameters;
                        properties.situationType = 'police';
                        if(!!components.result.parameters.fireSituation){
                            properties.situationType = 'fire';
                        }else if(!!components.result.parameters.ambulanceSituation){
                            properties.situationType = 'ambulance';
                        }else if(!!components.result.parameters.disasterSituation){
                            properties.situationType = 'disaster';
                        }
                        var requestProperties = {userId:senderId,properties:components.result.parameters,_created:NumberLong(now), _modified:NumberLong(now)};
                        db.collection('RequestProperties').insertOne(requestProperties,function (err, doc) {
                            locationRequest(senderId,db);
                        });
                    }else if(!!components.result.parameters){
                        var now = new Date().getTime();
                        var requestProperties = {userId:senderId,properties:components.result.parameters,_created:NumberLong(now), _modified:NumberLong(now)};
                        db.collection('RequestProperties').insertOne(requestProperties,function (err, doc) {
                            situationRequest(senderId,db);
                        });
                    }else{
                        situationRequest(senderId,db);
                    }

                }else if(!!components && !! (components.result.metadata || {}).intentName && (components.result.metadata || {}).intentName.indexOf('boafo.weather') > -1){
                    (function (recipientId,db) {
                        sendMessage(recipientId,{
                            attachment:{
                                type:"template",
                                payload:{
                                    template_type:"button",
                                    text:"That's ponchos speciality",
                                    buttons:[
                                        {
                                            "type":"web_url",
                                            "url":"http://m.me/788720331154519",
                                            "title":"Talk to Poncho",
                                        }
                                    ]
                                }
                            }
                        },db);
                    })(senderId,db);
                }else if(!!components && !! (components.result.metadata || {}).intentName && (components.result.metadata || {}).intentName.indexOf('boafo.recommendations') > -1){
                    (function (recipientId,db) {
                        sendMessage(recipientId,{
                            attachment:{
                                type:"template",
                                payload:{
                                    template_type:"button",
                                    text:"That's Rendezvous speciality",
                                    buttons:[
                                        {
                                            "type":"web_url",
                                            "url":"http://m.me/897712613708670?ref=help",
                                            "title":"Talk to Rendezvous",
                                        }
                                    ]
                                }
                            }
                        },db);
                    })(senderId,db);
                }else if(!!components && !! (components.result.metadata || {}).intentName && (components.result.metadata || {}).intentName.indexOf('boafo.psychologist') > -1){

                    var questions = [
                        'What brings you here?','Have you ever seen a counselor before?','What is the problem from your viewpoint?',
                        'How does this problem typically make you feel?','What makes the problem better?','If you could wave a magic wand, what positive changes would you make happen in your life?',
                        'Overall, how would you describe your mood?','What do you expect from the counseling process?','What would it take to make you feel more content, happier and more satisfied?',
                        'Do you consider yourself to have a low, average or high interpersonal IQ?'
                    ];
                    (function (recipientId,db) {
                        sendMessage(recipientId,{
                            text:questions[Math.round(Math.random() * questions.length)]
                        },db);
                    })(senderId,db);
                }else{
                    db.collection('ChatMessage').find({senderId:FACEBOOK_PAGE_ID}).sort({'_created':-1}).toArray(function(err,lastBotMessages){
                        var lastBotMessage = lastBotMessages[0];
                        console.log(lastBotMessage.message);
                        if(!!lastBotMessage && lastBotMessage.message.indexOf('Send or Type in your location') > -1){
                            db.collection('RequestProperties').find({userId:senderId}).sort({_created:-1}).toArray(function (err, docs) {
                                var requestProperties = (docs || [])[0] || {};
                                var shareLocationCallback = function (recipientId,emergencyContact,db) {
                                    sendMessage(recipientId,{
                                        attachment:{
                                            type:"template",
                                            payload:{
                                                template_type:"button",
                                                text:`${emergencyContact.location.name} is closest to you. Click the button below to call in?`,
                                                buttons:[
                                                    {
                                                        "type":"phone_number",
                                                        "title":"Call",
                                                        "payload":emergencyContact.tel
                                                    }
                                                ]
                                            }
                                        }
                                    },db);
                                };
                                if(!!text){
                                    googleMapsClient.geocode({
                                        address: text
                                    }, function(err, response) {
                                        if (!err) {
                                            var latlng = response.json.results[0].geometry.location;
                                            var emergencyType = (requestProperties.properties || {}).situationType || 'police';
                                            latlng.long = latlng.lng;
                                            delete latlng.lng;

                                            db.collection('EmergencyContacts').find({type:emergencyType}).toArray(function (err, docs) {
                                                docs = (docs||[]).sort(function (a,b) {
                                                    return distanceApart(a.location,latlng) - distanceApart(b.location,latlng);
                                                });
                                                var emergencyContact = docs[0] || {};
                                                console.log('latlng',latlng);
                                                console.log('emergencyContact',emergencyContact);
                                                emergencyContact.tel = (emergencyContact.tel || ((requestProperties || {}).properties || {})['phone-number']||911);
                                                shareLocationCallback(senderId,emergencyContact,db);
                                            });
                                        }else{
                                            //TODO handle location not found
                                        }
                                    });
                                }else{
                                    var latlng = req.body.entry[0].messaging[0].message.attachments[0].payload.coordinates;
                                    var emergencyType = (requestProperties.properties || {}).situationType || 'police';
                                    db.collection('EmergencyContacts').find({type:emergencyType}).toArray(function (err, docs) {
                                        docs = (docs||[]).sort(function (a,b) {
                                            return distanceApart(a.location,latlng) - distanceApart(b.location,latlng);
                                        });
                                        var emergencyContact = docs[0] || {};
                                        console.log('latlng',latlng);
                                        emergencyContact.tel = (emergencyContact.tel || ((requestProperties || {}).properties || {})['phone-number']||911);
                                        shareLocationCallback(senderId,emergencyContact,db);
                                    });
                                }

                            });
                        }else if(text == 'GET_STARTED'){
                            (function (recipientId,text,db) {
                                getUserProfile(recipientId,function (user) {
                                    sendMessage(recipientId,{
                                        text: `Hello ${user.first_name} ${'\u{263A}'}! \n\nI can help you with emergencies or basic psychotherapy. Type help whenever you need help!`
                                    },db);
                                })
                            })(senderId,text,db);
                        }else if(!!text && text.toLowerCase().trim() == 'help'){
                            (function (recipientId,text,db) {
                                getUserProfile(recipientId,function (user) {
                                    sendMessage(recipientId,{
                                        text: `How may I help you?`,
                                        quick_replies:[
                                            {content_type:'text',title:'Emergency',payload:'help me call 911'},
                                            {content_type:'text',title:'Basic psychotherapy',payload:'I need a psychologist'},
                                        ]
                                    },db);
                                })
                            })(senderId,text,db);
                        }else{
                            if(!!components && components.result.action.indexOf('smalltalk') > -1){
                                (function (recipientId,text,db) {
                                    sendMessage(recipientId,{text: components.result.speech},db);
                                })(senderId,text,db);
                            }else{

                            }
                        }
                    });

                }

            });
        });
    });



    res.send('');
});



http.listen(app.get('port'),app.get('ip'),function () {
    console.log('Node app is running on port', app.get('port'));
});


require('fs').readFile( __dirname +'/seed_data/emergency_numbers.csv', 'utf8', function (err,data) {
    if (err) {
        return console.log(err);
    }
    MongoClient.connect(mongo_url,function(err,db){
        var entries = [];
        data.split('\n').forEach(function (line,index) {
            if(index > 0){

                var columns = line.split(',');
                var now = new Date().getTime();

                entries.push({
                    type:columns[0],
                    tel:columns[1],
                    location:{
                        name:columns[2],
                        lat:columns[3],
                        long:columns[4]
                    },
                    _created:NumberLong(now),
                    _modified:NumberLong(now)
                });
            }
        });

        db.collection('EmergencyContacts').removeMany({},function (err, result) {
            db.collection('EmergencyContacts').insertMany(entries,function(err,doc){
                db.close();
            })
        })

    })

});






