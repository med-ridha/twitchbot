import EventSub from './EventSub';

const eventSub = new EventSub();

async function main() {
    if (eventSub.accessToken === '' || eventSub.refreshToken === '') {
        await eventSub.getAccessToken();
    }
    await eventSub.listentoEventSubGiftSub();
}


main();
