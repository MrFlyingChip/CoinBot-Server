const parseXlsx = require('excel');
const https = require('https');
var request = require('sync-request');

var options = {
    "method": "GET",
    "hostname": "rest.coinapi.io",
    "path": "/v1/exchangerate/",
    "headers": {'X-CoinAPI-Key': '76C22A1B-32F2-45CD-A2B5-AEA08A067075'}
};

var parseDate = function (date) {
    let splitDate = date.split('.');
    let data = new Date(splitDate[2], splitDate[1] - 1, splitDate[0], 0, 0, 0);
    data.setHours(data.getHours() + 2);
    return data.toISOString();
};

function createPart(parseExcelData, dealCounter, dataExcelCounter, partBudget, foundStrategy, db, parts) {
    while (dealCounter < foundStrategy.partsNumber && dataExcelCounter < parseExcelData.length) {
        let date = parseDate(parseExcelData[dataExcelCounter].date);
        inputNewDeal(parseExcelData[dataExcelCounter], parts, date, foundStrategy.name, partBudget);
        dealCounter++;
        dataExcelCounter++;
    }
    console.log('Завершена первоначальная загрузка');
    simulateCoin(parseExcelData, partBudget, parts, db, foundStrategy);
}

function simulateCoin(parseExcelData, partBudget, parts, db, foundStrategy) {
    let incomeBTC = 0;
    let allParts = [];
    for (let dealCounter = 0; dealCounter < parts.length; dealCounter++) {
        let dateCounter = 0;
        let date = new Date(parts[dealCounter].date);
        date.setHours(new Date(parts[dealCounter].date).getHours() + dateCounter);
        while (parts[dealCounter].status !== 'Завершена' && date < new Date() && parts[dealCounter].status !== 'Ошибка') {
            date = date.toISOString();
            parts[dealCounter].days = (dateCounter % 24 === 0) ? parts[dealCounter].days + 1 : parts[dealCounter].days;
            try {
                var res = request('GET', 'https://rest.coinapi.io/v1/ohlcv/BITTREX_SPOT_' + parts[dealCounter].coin + '_BTC/history?period_id=1DAY&time_start=' + date, {
                    headers: {
                        'X-CoinAPI-Key': '76C22A1B-32F2-45CD-A2B5-AEA08A067075',
                    },
                });
                let result = JSON.parse(res.getBody());

                let rate = result[0].price_high;
                let currentPrice = rate;
                if (parts[dealCounter].maxPrice < currentPrice) {
                    parts[dealCounter].maxPrice = currentPrice;
                }
                parts[dealCounter].currentPrice = currentPrice;
                let coin = partBudget / parts[dealCounter].inputPrice;
                parts[dealCounter].incomeBTC = coin * rate - partBudget;
                let income = parts[dealCounter].incomeBTC * 100 / partBudget;
                parts[dealCounter].currentIncome = income;
                try {
                    res = request('GET', 'https://rest.coinapi.io/v1/ohlcv/BINANCE_SPOT_BTC_USDT/history?period_id=1DAY&time_start=' + date, {
                        headers: {
                            'X-CoinAPI-Key': '76C22A1B-32F2-45CD-A2B5-AEA08A067075',
                        },
                    });
                    result = JSON.parse(res.getBody());
                    rate = result[0].price_high;
                    parts[dealCounter].incomeDollars = parts[dealCounter].incomeBTC * rate;
                    let percent = parts[dealCounter].currentIncome;
                    if (parts[dealCounter].days <= foundStrategy.limitDays) {
                        if (percent >= foundStrategy.percentProfit) {
                            parts[dealCounter].status = 'Завершена';
                            incomeBTC += parts[dealCounter].incomeBTC;
                            let dataExcelCounter = 0;
                            while ((incomeBTC - partBudget) > 0) {
                                if (dataExcelCounter < parseExcelData.length) {
                                    let date1 = parseDate(parseExcelData[dataExcelCounter].date);
                                    if (!parseExcelData[dataExcelCounter].used && new Date(date) < new Date(date1)) {
                                        parseExcelData[dataExcelCounter].used = true;
                                        inputNewDeal(parseExcelData[dataExcelCounter], parts, date1, foundStrategy.name, partBudget);
                                        dataExcelCounter++;
                                    } else {
                                        dataExcelCounter++;
                                    }
                                } else {
                                    break;
                                }
                                incomeBTC -= partBudget;
                            }
                        } else if (percent < 0 && Math.abs(percent) >= foundStrategy.percentMinus) {
                            parts[dealCounter].status = 'Завершена';
                        }
                    } else {
                        if (foundStrategy.closeParts) {
                            for (let i = 0; i < foundStrategy.parts.length; i++) {
                                if (percent >= foundStrategy.parts[i]) {
                                    if (!parts[dealCounter].closedParts.includes(i)) {
                                        parts[dealCounter].closedParts.push(i);
                                        incomeBTC += (parts[dealCounter].incomeBTC / foundStrategy.parts.length);
                                    }
                                }
                            }
                            let closed = parts[dealCounter].closedParts.length;
                            parts[dealCounter].status = (closed === foundStrategy.parts.length) ? 'Завершена' : closed + '/' + foundStrategy.parts.length;
                        } else {
                            if (Math.abs(percent) >= foundStrategy.percentClose) {
                                parts[dealCounter].status = 'Завершена';
                                if (percent > 0) {
                                    incomeBTC += parts[dealCounter].incomeBTC;
                                }
                            }
                        }
                    }
                    const deal = currentDeal(parts[dealCounter], date);
                    console.log(deal);
                    allParts.push(deal);
                } catch (e) {
                    parts[dealCounter].status = 'Ошибка';
                    console.log(e.message);
                }
            } catch (e) {
                parts[dealCounter].status = 'Ошибка';
                console.log(e.message);
            }
            dateCounter += 24;
            date = new Date(parts[dealCounter].date);
            date.setHours(new Date(parts[dealCounter].date).getHours() + dateCounter);
        }
        let dataExcelCounter = 0;
        while (dataExcelCounter < parseExcelData.length) {
            let date1 = parseDate(parseExcelData[dataExcelCounter].date);
            if (!parseExcelData[dataExcelCounter].used && new Date(date) < new Date(date1)) {
                parseExcelData[dataExcelCounter].used = true;
                inputNewDeal(parseExcelData[dataExcelCounter], parts, date1, foundStrategy.name, partBudget);
                dataExcelCounter++;
            } else {
                dataExcelCounter++;
            }
        }
    }
    if (parts.length > 0) {
        db.collection('parts').insertMany(parts, (err, result) => {
            if (err) {
                //console.log(err)
            } else {
                console.log('Части загружены!');
            }
        });
        db.collection('allParts').insertMany(allParts, (err, result) => {
            if (err) {
                //console.log(err)
            } else {
                console.log('Части загружены!');
            }
        });
        db.collection('users').find().toArray((err, docs) => {
            if (err) console.log({'error': err});
            else {
                let profitParts = 0;
                let minusParts = 0;
                let waitParts = 0;
                let percentProfit = 0;
                let profit = 0;
                let price = partBudget * foundStrategy.partsNumber;
                for (let j = 0; j < parts.length; j++) {
                    profit += parts[j].incomeBTC;
                    if (parts[j].status === 'Завершена') {
                        if (parts[j].incomeBTC >= 0) profitParts++;
                        else minusParts++;
                    }
                    else {
                        waitParts++;
                    }
                }
                let percent = profit * 100 / price;
                percentProfit = percent.toFixed(2);
                for (let i = 0; i < docs.length; i++) {
                    var res = request('GET', 'https://api.telegram.org/bot571455368:AAF65ScR2kTNEvt9rLqRSrH5N3roZaR6sC8/sendMessage?chat_id=' + docs[i].user + '&text=Simulation ended!\nSuccessful deals: ' + profitParts + '\nUnsuccessful deals: ' + minusParts + '\nDeals pending: ' + waitParts + '\nProfit: ' + percentProfit + '%');
                }

            }
        });
    }
}

function inputNewDeal(part, parts, date, strategyName, partBudget) {
    let coin = part.coin;
    let recommendedValue = part.rate;
    part.used = true;
    const deal = {
        strategy: strategyName,
        coin: coin,
        date: date,
        inputPrice: recommendedValue,
        budget: partBudget,
        currentPrice: recommendedValue,
        maxPrice: recommendedValue,
        currentIncome: 0,
        incomeBTC: 0,
        incomeDollars: 0,
        days: 0,
        closedParts: [],
        status: null
    };
    parts.push(deal);

}

function currentDeal (deal, date) {
    return {
        strategy: deal.strategy,
        coin: deal.coin,
        date: deal.date,
        inputPrice: deal.inputPrice,
        budget: deal.budget,
        currentPrice: deal.currentPrice,
        maxPrice: deal.maxPrice,
        currentIncome: deal.currentIncome,
        incomeBTC: deal.incomeBTC,
        incomeDollars: deal.incomeDollars,
        days: deal.days,
        closedParts: deal.closedParts,
        status: deal.status,
        currentDate: date
    };
}

module.exports = function (db, newDeal) {
    const strategy = {'name': newDeal.strategy};
    console.log(strategy);
    db.collection('strategies').findOne(strategy)
        .then(foundStrategy => {
                console.log(foundStrategy);
                parseXlsx('uploads/' + foundStrategy.coin, (errorExcel, parseExcelData) => {
                    if (errorExcel) {
                        console.log(errorExcel.name + ': ' + errorExcel.message);
                    } else {
                        let deals = [];
                        let dealCounter = 0;
                        let dataExcelCounter = 1;
                        let partBudget = newDeal.budget / foundStrategy.partsNumber;
                        db.collection('users').find().toArray((err, docs) => {
                            if (err) console.log({'error': err});
                            else {
                                for (let i = 0; i < docs.length; i++) {
                                    //bot.sendMessage(docs[i].user, "Симуляция началась!", {caption: "I'm a bot!"});
                                    var res = request('GET', 'https://api.telegram.org/bot571455368:AAF65ScR2kTNEvt9rLqRSrH5N3roZaR6sC8/sendMessage?chat_id=' + docs[i].user + '&text=Simulation started!');

                                }
                                let excelData = [];
                                for (let i = 0; i < parseExcelData.length; i++) {
                                    if (parseExcelData[i][0] === '') {
                                        break;
                                    }
                                    else {
                                        excelData.push({
                                            date: parseExcelData[i][0],
                                            coin: parseExcelData[i][1],
                                            rate: parseExcelData[i][2],
                                            used: false
                                        });
                                    }
                                }
                                createPart(excelData, dealCounter, dataExcelCounter, partBudget, foundStrategy, db, deals);
                            }
                        });

                        //console.log(deals);
                    }
                });
            },
            errorDB => {
                console.log(errorDB.name + ': ' + errorDB.message);
            });
};

