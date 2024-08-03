import EventSub from './EventSub';
import getAccessToken from './getAccessToken';

const eventSub = new EventSub();

async function main() {
    if (eventSub.accessToken === '') {
        await getAccessToken();
    }
    await eventSub.listentoEventSubGiftSub();
}


main();
