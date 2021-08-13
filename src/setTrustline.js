const conf = new (require('conf'))()
const chalk = require('chalk')
const Stellar = require('stellar-sdk')
var StellarBase = require('stellar-base');
const { TimeoutInfinite } = require('stellar-base');
const bip39 = require('bip39')
const ed25519 =  require('@hawkingnetwork/ed25519-hd-key-rn');
const config = require('../config.json');
const prompt = require('prompt-sync')({ sigint: true });
const CLI = require('clui');
const Spinner = CLI.Spinner;


function setTrustline() {

    console.log(chalk.yellowBright('-----------------------------------------------'))
    console.log(chalk.yellowBright('Pi Wallet CLI'), chalk.magentaBright('Set Trustline'))
    console.log(chalk.yellowBright('-----------------------------------------------'), '\n')

    //get source account information
    var accountAddress = config.my_address
    if (!accountAddress){
        var accountAddress = prompt(chalk.yellowBright('Source Account Address: '));
    }
    const accountPassphrase = prompt(chalk.yellowBright('Source Account Passphrase/PrivateKey: '));

    //get asset information
    const assetName = prompt(chalk.yellowBright('Asset Name: '));
    const issuerAddress = prompt(chalk.yellowBright('Issuer Account Address: '));

    const status = new Spinner('Making transaction, please wait...');
    status.start();

    //create server object
    const server = new Stellar.Server(config.server)

    //helper function to return Key Pair from Passphrase
    const getKeyPairFromPassphrase = async function (passphrase) {
        const seed = await bip39.mnemonicToSeed(passphrase)
        const derivedSeed = ed25519.derivePath("m/44'/314159'/0'", seed)
        return Stellar.Keypair.fromRawEd25519Seed(derivedSeed.key)
    }

    //helper function to return KeyPair from Private Key
    const getKeyPairFromSecret = async function (secret) {
        return Stellar.Keypair.fromSecret(secret)
    }

    const fail = (message) => {
        console.log('\n')
        console.error(chalk.red(message))
        if (message.response && message.response.data && message.response.data.extras && message.response.data.extras.result_codes && message.response.data.extras.result_codes.operations) {
            const reason = message.response.data.extras.result_codes.operations;
            switch(reason) {
                case 'op_underfunded':
                    console.log(chalk.red('reason:', 'Sender account has insufficient funds'));
                    break;
                default:
                    console.log(chalk.red('reason:', reason))
            }
        }
        process.exit(1)
    }

    //building transaction function
    const transaction = async (keypair) => {

        const customAsset = new Stellar.Asset(assetName, issuerAddress);

        const txOptions = {
            fee: await server.fetchBaseFee(),
            networkPassphrase: config.networkPassphrase,
        }
        const changeTrustOpts = {
            asset: customAsset
        };
        const buyerAccount = await server.loadAccount(accountAddress)
        const transaction = new Stellar.TransactionBuilder(buyerAccount, txOptions)
            .addOperation(Stellar.Operation.changeTrust(changeTrustOpts))
            .setTimeout(0)
            .build();

        transaction.sign(keypair)

        const response = await server.submitTransaction(transaction)
        return response
    }

    var getKeyPair;
    if (StellarBase.StrKey.isValidEd25519SecretSeed(accountPassphrase)) {
        getKeyPair = getKeyPairFromSecret;
    } 
    else {
        getKeyPair = getKeyPairFromPassphrase;
    }

    getKeyPair(accountPassphrase)
    .then((res) => transaction(res)
        .then((tn) => {
            if (tn.successful){
                status.stop();
                console.log(chalk.green(`\nTransaction succeeded!\nDestination: ${destAccountAddress}\nAmt: ${transferAmt}\nMemo: ${transferMemo}\nLink: ${tn._links.transaction.href}`))
            }else{
                status.stop();
                console.log(chalk.red('\nTransaction Failed'))
            }
        })
        .catch(fail)
    )
    .catch((e) => {status.stop(); console.error(e); throw e})

}

module.exports = setTrustline