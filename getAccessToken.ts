// this should only be ran once per CODE
// the handling of the tokens is garbage i know 
import 'dotenv/config';
import fetch from 'node-fetch';
import fs from 'fs';
async function getAccessToken() {
    const getAccesTokenURL = `https://id.twitch.tv/oauth2/token?client_id=${process.env.TWITCH_CLIENT_ID}&client_secret=${process.env.TWITCH_SECRET}&code=${process.env.CODE}&grant_type=authorization_code&redirect_uri=${process.env.REDIRECT_URI}`;
    console.log("***getAccessToken***")
    let response = await fetch(encodeURI(getAccesTokenURL), {
        method: "POST",
    });
    let tokenData: any = await response.json();
    console.log(tokenData);
    if (tokenData.access_token) {
        fs.writeFileSync('token.txt', tokenData.access_token);
        fs.writeFileSync('refreshToken.txt', tokenData.refresh_token);
    } else {
        console.log('sorry something went wrong acquiring the token!')
        process.exit(1);
    }
    console.log("***end getAccessToken***")
}

export default getAccessToken;
