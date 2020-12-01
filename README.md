# DOLAR SCRAPPER
Get convertion value of all alternatives to buy USS in ARS

## How to USE
```bash
$ node dolar-scrapper.js --help
Options:
      --version  Show version number                                   [boolean]
  -p, --ars      Amount of ARS to convert to USD (p of 'Peronios')
  -d, --usd      Amount of USD to convert to ARS
  -h, --help     Show help                                             [boolean]
```

## Ouput
```bash
$ node dolar-scrapper.js -p 30000 -d 500
MEP  | 149.28358208955223 [5001 / 33.5]           | ARS -> USD: 200.96 | USD -> ARS: 74641.79
BLUE | 155,00                                     | ARS -> USD: 193.55 | USD -> ARS: 77500.00
BNA  | 86.5 (142.725)                             | ARS -> USD: 346.82 | USD -> ARS: 43250.00
DAI  | 154.45544554455446                         | ARS -> USD: 194.23 | USD -> ARS: 77227.72
USDC | 157.41 {0.01}                              | ARS -> USD: 190.59 | USD -> ARS: 78705.00
```

### Features

- [x] Dinamic loading (non-block)
- [x] Concurrent retrievers
- [x] Colors
- [x] Retry

