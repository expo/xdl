import imageType from "image-type";
import fs from 'fs-extra';
import Request from 'request-promise-native';
import promisify from "util.promisify";
import {PNG} from 'pngjs';
import sizeOf from 'image-size';


const readFileAsync = promisify(fs.readFile);

function _hasAlpha(image) {
    const png = PNG.sync.read(image);
    return png.alpha
}

function _hasWrongRatio(image) {
    const {width, height} = sizeOf(image);
    return width !== height;
}

export async function isIconOk(iconLocation: string, alpha_tolerated: boolean) {
    let image = null;
    if (fs.existsSync(iconLocation)) {
        image = await readFileAsync(iconLocation)
    } else {
        image = await Request.get(iconLocation, {encoding: null})
    }
    console.log(`Testing: ${iconLocation} with ${alpha_tolerated ? "" : "no "}tolerance for alpha.`);
    const {ext: type} = imageType(image);
    if (type === 'png' && !alpha_tolerated) {
        if (_hasAlpha(image)) {
            throw 'Should not contain alpha!'
        }
    }
    if (type === 'png' || type === 'jpg') {
        if (_hasWrongRatio(image)) {
            throw 'Should be a square!'
        }
    }
    else {
        throw 'I would\'t use this type of image';
    }
    return true;

}

function success() {
    return console.log('Image ok!');
}

function fail(e) {
    return console.log(`Image invalid => ${e}`);
}

async function test() {
    await isIconOk('https://image.freepik.com/free-icon/macos-platform_318-33076.jpg').then(success).catch(fail);
    await isIconOk('https://upload.wikimedia.org/wikipedia/commons/6/6f/HP_logo_630x630.png', true).then(success).catch(fail);
    await isIconOk('https://upload.wikimedia.org/wikipedia/commons/6/6f/HP_logo_630x630.png').then(success).catch(fail);
    await isIconOk('http://www.creationlogo.org/wp-content/uploads/2017/08/Logo_TV_2015.png', true).then(success).catch(fail);
    await isIconOk('http://www.creationlogo.org/wp-content/uploads/2017/08/Logo_TV_2015.png').then(success).catch(fail);
}

test();