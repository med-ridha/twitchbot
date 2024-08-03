import 'dotenv/config';
const app = require('express')();
const url = `https://id.twitch.tv/oauth2/authorize?response_type=code&client_id=${process.env.TWITCH_CLIENT_ID}&redirect_uri=${process.env.REDIRECT_URI}&scope=channel:read:subscriptions&state=c3ab8aa609ea11e793ae92361f002671`
console.log(url);
app.listen(3000, () => {
    console.log('Server is running on port 3000');
});

app.get('/', (req: any, res: any) => {
    //get the code parameter from the query string
    let code = req.query.code;
    console.log(code);
    res.send(200);
});
app.get('/auth/twitch/callback', (req: any, res: any) => {
    //get the code parameter from the query string
    let code = req.query.code;
    console.log(req.query);
    res.send(200)
});

