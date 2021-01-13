const requestPromise = require('request-promise');
const cheerio = require('cheerio');
const yargs = require('yargs');
const DraftLog = require('draftlog'); DraftLog.into(console);
const colors = require('colors'); 
const promiseRetry = require('promise-retry');

const SPINNER_CHARS = '⣾ ⣽ ⣻ ⢿ ⡿ ⣟ ⣯ ⣷'.split(' ');

const argv = yargs
    .option('ars', {
        alias: 'p',
        description: 'Amount of ARS to convert to USD',
        type: 'number',
    })
    .option('usd', {
        alias: 'd',
        description: 'Amount of USD to convert to ARS',
        type: 'number',
    })
    .option('al30', {
        description: 'Unit price of buyed al30 to see real conversion',
        type: 'number',
    })
    .help()
    .alias('help', 'h')
    .argv;

class Retriever {
    retryCallback = () => {};
    
    name() { throw Error('Must be implemented') }
    retrieve() { throw Error('Must be implemented') }
    onRetry(callBack) { this.retryCallback = callBack; }

    retry(promise) {
        return promiseRetry((retry, number) => {
            this.retryCallback(number);
            return promise.catch(retry);
        }, {retries: 3});
    }
}

class IOLRetriever extends Retriever {
    
    retrieveValue(url) {
        return this.retry(requestPromise(url))
            .then(html => {
                const $ = cheerio.load(html);
                return $("#IdTitulo > span[data-field='UltimoPrecio']").text()
            })
            .then(value => {
                const dotValue = value.replace('.', '').replace(',', '.');
                return parseFloat(dotValue);
            });
    }

    getUrls() {
        throw Error('Must be implemented and returns {ars, usd}');
    }

    retrieveMep() {
        const {ars, usd} = this.getUrls();
        const titlePromise = this.retrieveValue(ars);
        const titleDPromise = this.retrieveValue(usd);
        return Promise.all([titlePromise, titleDPromise])
            .then(([title, titleD]) => {
                const mep = {title, titleD, total: title/titleD};
                return {value: mep.total, pretty: `${mep.total.toFixed(2)} [${mep.title} / ${mep.titleD}]`, extra: {ars: mep.title, usd: mep.titleD}};
            });
    }

    retrieve() {
        return this.retrieveMep();
    }


}

class AY24Retriever extends IOLRetriever {
    name() { return 'AY24'; }

    getUrls() {
        return {
            ars: "https://www.invertironline.com/titulo/cotizacion/BCBA/AY24/",
            usd: "https://www.invertironline.com/titulo/cotizacion/BCBA/AY24D/"
        }
    }
}

class AL30Retriever extends IOLRetriever {
    name() { return 'AL30'; }

    getUrls() {
        return {
            ars: "https://www.invertironline.com/titulo/cotizacion/BCBA/AL30/BONO-REP.-ARGENTINA-USD-STEP-UP-2030/",
            usd: "https://www.invertironline.com/titulo/cotizacion/BCBA/AL30D/BONO-REP.-ARGENTINA-USD-STEP-UP-2030/"
        }
    }

    async retrieve() {
        const data = await super.retrieve();
        if (argv.al30) { 
            const value = argv.al30/data.extra.usd;
            const actualValue = `${data.value.toFixed(2)}`;
            const pretty = `${value.toFixed(2)} [${argv.al30} / ${data.extra.usd}] {${actualValue}}`;
            return {...data, pretty, value};
        }
        return data;
    }
}

class BlueRetriever extends Retriever {
    name() { return 'BLUE' }
    
    retrieve() {
        return this.retry(requestPromise("https://api-contenidos.lanacion.com.ar/json/V3/economia/cotizacionblue/DBLUE"))
            .then(response => {
                const blueData = JSON.parse(response);
                const value = parseFloat(blueData.venta.replace(',', '.'));
                return {value, pretty: `${value.toFixed(2)}`};
            });
    }
}

class OfficialRetriever extends Retriever {
    name() { return 'BNA'; }

    retrieve() {
        return this.retry(requestPromise("https://www.bna.com.ar/Personas"))
            .then(html => {
                const $ = cheerio.load(html);
                return $("#billetes > table > tbody > tr:nth-child(1) > td:nth-child(3)").text();
            })
            .then(valueString => {
                //console.log(value);
                const value = parseFloat(valueString.replace(',', '.'));
                return { value, pretty: `${value} (${value * (1.3 + 0.35)})` }
            }); 
    }
}

class DAIRetriever extends Retriever {
    name() { return 'DAI' }
    retrieve() {
        return this.retry(requestPromise("https://be.buenbit.com/api/market/tickers/"))
            .then(res => {
                const data = JSON.parse(res);
                const arsdai = parseFloat(data.object.daiars.selling_price);
                const daiusd = parseFloat(data.object.daiusd.purchase_price);
                const daiToUsd = arsdai/daiusd; 
                return { value: daiToUsd, pretty: `${daiToUsd.toFixed(2)}` };
            });
    }
}

class USDCRetriever extends Retriever {
    name() { return 'USDC'; }

    retrieve() {
        return this.retry(requestPromise('https://app.ripio.com/api/v3/rates/?country=AR'))
            .then(res => {
                const data = JSON.parse(res);
                const usdc = data.find(a => a.ticker === 'USDC_ARS');
                return usdc && usdc.buy_rate ? { value: usdc.buy_rate, pretty: `${usdc.buy_rate} {${usdc.variation}}` } : { value: -1, pretty: `-1` };
            });
    }

}

class ConsoleLine {
    message = '';
    consoleUpdated = () => {};
    lap = 0;
    timeout = null;
    constructor(message) {
        this.message = message;
        this.consoleUpdated = console.draft(message);
        this.startSpinner();
    }
    setMessage(message) {
        this.message = message;
        this.consoleUpdated(this.message);
    }

    endSpinner(message) {
        this.activeSpinner = false;
        clearTimeout(this.timeout);
        this.setMessage(message ? message : this.message);
    }

    async startSpinner() {
        this.lap = 0;
        this.activeSpinner = true;
        while (this.activeSpinner) {
            this.renderSpinner();
            await new Promise((accept) => { this.timeout = setTimeout(() => accept(), 100); });
        }
    }

    renderSpinner() {
        const spinner = `${SPINNER_CHARS[this.lap++ % SPINNER_CHARS.length]}`.bold.green;
        this.consoleUpdated(`${this.message} ${spinner}`);
    }
}

const retrievers = [AY24Retriever, AL30Retriever, BlueRetriever, OfficialRetriever, DAIRetriever, USDCRetriever];
retrievers.forEach(retrieverClass => {
    const instance = new retrieverClass();
    const name = instance.name().padEnd(5, ' ');
    const consoleLine = new ConsoleLine(`${name}| Loading`);
    instance.onRetry((number) => {
        if (number > 1) {
            consoleLine.setMessage(`${name}| Retrying ${number}`.bold.yellow);
        }
    });
    
    instance.retrieve()
        .then(data => {
            let message = `${name}| ${data.pretty}`;
            if (argv.ars) {
                const conversion = `${(parseFloat(argv.ars)/data.value).toFixed(2)}`.bold.green;
                message = `${message.padEnd(50, ' ')}| ARS -> USD: ${conversion}`;
            }
            if (argv.usd) {
                const conversion = `${(parseFloat(argv.usd) * data.value).toFixed(2)}`.bold.blue;
                message = `${message.padEnd(90, ' ')}| USD -> ARS: ${conversion}`;
            }
            consoleLine.endSpinner(message);
        })
        .catch(err => consoleLine.endSpinner(`${name}| ERR: ${err.message}`.bold.red));
});

