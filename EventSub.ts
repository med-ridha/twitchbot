import 'dotenv/config';
import WebSocket from 'ws';
import fetch from 'node-fetch';
import fs from 'fs';
class EventSub {
    keepalive_timeout_seconds = 30;
    webSocketServerURL = 'wss://eventsub.wss.twitch.tv/ws?keepalive_timeout_seconds=' + this.keepalive_timeout_seconds;
    //webSocketServerURL = 'ws://127.0.0.1:8080/ws?keepalive_timeout_seconds=' + this.keepalive_timeout_seconds;
    subURL = 'https://api.twitch.tv/helix/eventsub/subscriptions';
    //subURL = 'http://localhost:8080/eventsub/subscriptions';
    sessionId: string | null = null;
    subId: string | null = null;
    clientID: string | null = null;
    messageIDs: string[] = [];
    wss: WebSocket[] = [];
    timer: number | null = null
    timerInterval: NodeJS.Timeout | null = null;
    public accessToken: string | null = null;
    public refreshToken: string | null = null;
    constructor() {
        this.accessToken = fs.readFileSync('token.txt', 'utf8');
        this.refreshToken = process.env.REFRESH_TOKEN!;
        this.clientID = process.env.TWITCH_CLIENT_ID!;
        // for now we should cancel the sub when closing the client
        // because it counts toward a limit, to close the client use CTRL+C
        process.on('SIGINT', this.handleExit.bind(this));
    }
    async listentoEventSubGiftSub(reconnect_url?: string | null): Promise<WebSocket> {

        const reconnect = reconnect_url ? true : false;
        const ws = new WebSocket(reconnect_url ?? this.webSocketServerURL);
        if (this.wss[0] === undefined) {
            console.log('pushing')
            this.wss.push(ws);
        }

        ws.on('open', () => {
            console.log('connected');
        })

        ws.on('ping', (data: any) => {
            console.log('ping');
            ws.pong(data);
        });

        ws.on('message', async (data) => {
            const message = JSON.parse(data.toString());
            if (this.messageIDs.includes(message.metadata.message_id)) {
                return;
            }
            this.messageIDs.push(message.metadata.message_id!);
            if (this.messageIDs.length > 10) {
                this.messageIDs.shift();
            }
            const messageType = message.metadata.message_type;
            console.log(messageType)
            switch (messageType) {
                case 'session_welcome':
                    if (!reconnect) {
                        console.log('*** creating the sub ***')
                        this.sessionId = message.payload.session.id;
                        let result = await this.subscribeToEventSub(this.sessionId!);
                        let resultData = await result.json();
                        if (resultData.status === 401) {
                            await this.handleUnauthorized();
                            result = await this.subscribeToEventSub(this.sessionId!);
                            resultData = await result.json();
                        }

                        console.log(resultData);
                        this.subId = resultData.data[0].id;
                    } else {
                        console.log('reconnected to the sub');
                        let oldWS = this.wss.shift();
                        if (oldWS) {
                            // remove all listeners than close the connection
                            oldWS.removeAllListeners();
                            oldWS.close();
                        }
                    }
                    this.timer = 0;
                    if (this.timerInterval !== null) {
                        clearInterval(this.timerInterval);
                    }
                    this.timerInterval = setInterval(async () => {
                        if (this.timer! >= this.keepalive_timeout_seconds + 5) {
                            this.wss.push(await this.listentoEventSubGiftSub());
                        }
                        this.timer!++
                    }, 1000)
                    break;
                case 'session_keepalive':
                    this.timer = 0;
                    console.log('keepalive');
                    break;
                case 'notification':
                    this.timer = 0;
                    console.log(message);
                    break;
                case 'session_reconnect':
                    console.log("*** reconnecting ***")
                    const reconnect_url = message.payload.session.reconnect_url;
                    this.wss.push(await this.listentoEventSubGiftSub(reconnect_url));
                    console.log("*** end reconnecting ***")
                    break;
                case 'revocation':
                    // TODO: handle revocation
                    console.log(message)
                    break;
            }
        });
        ws.on('close', async () => {
            console.log('connection closed');
            console.log('*** trying to create a new connection ***')
            this.wss = [];
            await this.listentoEventSubGiftSub();
        });
        return ws;
    }
    async handleUnauthorized() {
        console.log('*** refreshing token ***')
        let url = `https://id.twitch.tv/oauth2/token?client_id=${process.env.TWITCH_CLIENT_ID}&client_secret=${process.env.TWITCH_SECRET}&refresh_token=${this.refreshToken}&grant_type=refresh_token`;
        let response = await fetch(encodeURI(url), { method: "POST" });
        let data = await response.json();
        if (data.access_token) {
            require('fs').writeFileSync('token.txt', data.access_token);
            this.accessToken = data.access_token;
            console.log('got the token!');
        } else {
            console.log('sorry something went wrong refreshing the token!')
        }
        console.log('*** end refreshing token ***')
    }
    async subscribeToEventSub(id: string) {
        console.log('***subscribeToEventSub***');
        console.log(id);
        console.log('*** end debug ***')

        const options = {
            'Content-Type': 'application/json',
            'Client-Id': process.env.TWITCH_CLIENT_ID!,
            'Authorization': 'Bearer ' + this.accessToken
        }
        console.log(options)
        const result = await fetch(this.subURL, {
            method: 'POST',
            headers: options,
            body: JSON.stringify({
                "type": "channel.subscription.gift",
                "version": "1",
                "condition": {
                    "broadcaster_user_id": process.env.BROADCASTER_USER_ID
                },
                "transport": {
                    "method": "websocket",
                    "session_id": id
                }
            })
        })
        return result;
    }
    async handleExit() {
        console.log('*** HandleExit ***')
        await this.handleDeleteSub();
        console.log('*** End handleExit ***')
        process.exit(0);

    }

    async handleDeleteSub() {
        console.log('*** HandleSubCancel ***')
        const result = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions?id=' + this.subId!, {
            method: 'DELETE',
            headers: {
                'Client-Id': this.clientID!,
                'Authorization': 'Bearer ' + this.accessToken!,
            }
        })
        try {
            if ((await result.json()).status === 401) {
                await this.handleUnauthorized();
                await this.handleDeleteSub();
            }
        } catch (error) {
            console.log('subscription deleted');
        }
        console.log('*** End handleSubCancel ***')
    }
}

export default EventSub;
