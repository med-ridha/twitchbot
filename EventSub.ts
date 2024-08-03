import 'dotenv/config';
import WebSocket from 'ws';
import fetch from 'node-fetch';
import fs from 'fs';
class EventSub {
    getAccesTokenURL = `https://id.twitch.tv/oauth2/token?client_id=${process.env.TWITCH_CLIENT_ID}&client_secret=${process.env.TWITCH_SECRET}&code=${process.env.CODE}&grant_type=authorization_code&redirect_uri=${process.env.REDIRECT_URI}`;
    keepalive_timeout_seconds = 30;
    sessionId: string | null = null;
    subId: string | null = null;
    clientID: string | null = null;
    public accessToken: string | null = null;
    public refreshToken: string | null = null;
    constructor() {
        this.accessToken = fs.readFileSync('token.txt', 'utf8');
        this.refreshToken = process.env.REFRESH_TOKEN!;
        this.clientID = process.env.TWITCH_CLIENT_ID!;
    }
    async getAccessToken() {
        console.log("***getAccessToken***")
        let response = await fetch(encodeURI(this.getAccesTokenURL), {
            method: "POST",
        });
        let tokenData: any = await response.json();
        console.log(tokenData);
        if (tokenData.access_token) {
            this.accessToken = tokenData.access_token;
            this.refreshToken = tokenData.refresh_token;
            fs.writeFileSync('token.txt', this.accessToken!);
            fs.writeFileSync('refreshToken.txt', this.refreshToken!);
        } else {
            console.log('sorry something went wrong acquiring the token!')
            process.exit(1);
        }
        console.log("***end getAccessToken***")
    }
    async listentoEventSubGiftSub() {

        const ws = new WebSocket('wss://eventsub.wss.twitch.tv/ws?keepalive_timeout_seconds=' + this.keepalive_timeout_seconds);

        ws.on('open', () => {
            console.log('connected');
        })

        ws.on('ping', (data: any) => {
            console.log('ping');
            ws.pong(data);
        });

        ws.on('message', async (data) => {
            const message = JSON.parse(data.toString());
            switch (message.metadata.message_type) {
                case 'session_welcome':
                    this.sessionId = message.payload.session.id;
                    let result = await this.subscribeToEventSub(this.sessionId!);
                    let resultData = await result.json();
                    if (resultData.status === 401) {
                        await this.handleUnauthorized();
                        result = await this.subscribeToEventSub(this.sessionId!);
                        resultData = await result.json();
                    }
                    process.on('SIGINT', this.handleExit.bind(this));

                    console.log(resultData);
                    this.subId = resultData.data[0].id;
                    break;
                case 'session_keepalive':
                    console.log('keepalive');
                    break;
                case 'notification':
                    console.log(message);
                    break;
            }
        });
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
        const result = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
            method: 'POST',
            headers: options,
            body: JSON.stringify({
                "type": "channel.subscription.gift",
                "version": "1",
                "condition": {
                    "broadcaster_user_id": process.env.USER_ID
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
        console.log('***handleExit***')
        console.log(this.subId);
        console.log(this.clientID);
        console.log(this.accessToken);
        const result = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions?id=' + this.subId!, {
            method: 'DELETE',
            headers: {
                'Client-Id': this.clientID!,
                'Authorization': 'Bearer ' + this.accessToken!,
            }
        })
        console.log('subscription deleted');
        process.exit(0);

    }
}

export default EventSub;
