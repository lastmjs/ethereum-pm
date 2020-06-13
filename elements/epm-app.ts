import { html, render as litRender } from 'lit-html';
import { createObjectStore } from 'reduxular';
import { ethers } from 'ethers';
import '../test.js';

const ethersProvider = ethers.getDefaultProvider('ropsten');

const EPM_APP_PERSISTED_STATE = 'EPM_APP_PERSISTED_STATE';

type State = {
    readonly senderEthereumPrivateKey: string;
    readonly receiverEthereumAddress: string;
    readonly receiverEthereumPublicKey: string;
    readonly messageToSend: string;
    readonly messageToReceiveEncrypted: string;
    readonly messageToReceiveDecrypted: string;
    readonly messageHyperlink: string;
};

const persistedStateRaw: string | null = window.localStorage.getItem('EPM_APP_PERSISTED_STATE');
const persistedState: Readonly<State> | 'NOT_FOUND' = persistedStateRaw ? JSON.parse(persistedStateRaw) : 'NOT_FOUND';

const InitialState: Readonly<State> = {
    senderEthereumPrivateKey: persistedState === 'NOT_FOUND' ? '' : persistedState.senderEthereumPrivateKey,
    receiverEthereumAddress: persistedState === 'NOT_FOUND' ? '' : persistedState.receiverEthereumAddress,
    receiverEthereumPublicKey: persistedState === 'NOT_FOUND' ? '' : persistedState.receiverEthereumPublicKey,
    messageToSend: persistedState === 'NOT_FOUND' ? '' : persistedState.messageToSend,
    messageToReceiveEncrypted: persistedState === 'NOT_FOUND' ? '' : persistedState.messageToReceiveEncrypted,
    messageToReceiveDecrypted: persistedState === 'NOT_FOUND' ? '' : persistedState.messageToReceiveDecrypted,
    messageHyperlink: persistedState === 'NOT_FOUND' ? '' : persistedState.messageHyperlink
};

// TODO we need to store the serialized and encrypted message and swarm, and then retrieve it when possible
class EPMApp extends HTMLElement {

    readonly store = createObjectStore(InitialState, (state: Readonly<State>) => litRender(this.render(state), this), this);

    async connectedCallback() {
        const swarmHash: string | null = new URLSearchParams(window.location.search).get('swarm-hash');

        if (swarmHash !== null) {
            const swarmContent = await fetchSwarmContent(swarmHash);
    
            this.store.messageToReceiveEncrypted = swarmContent;

            const messageToReceiveDecryptedUint8Array = decryptMessage(this.store.senderEthereumPrivateKey, deserializeUint8Array(swarmContent));
            const messageToReceiveDecryptedString = new TextDecoder('utf-8').decode(messageToReceiveDecryptedUint8Array);

            this.store.messageToReceiveDecrypted = messageToReceiveDecryptedString;
        }
    }

    async sendClicked() {
        // const receiverEthereumPublicKey: string = await deriveEthereumPublicKeyFromEthereumAddress(this.store.receiverEthereumAddress);
    
        // console.log('receiverEthereumPublicKey', receiverEthereumPublicKey);
    
        const ethereumPM1 = new ethers.Wallet(`0x62B29D1AE19BF09856447A165E1DD4EE802726BAF3CDBA38250860B6460921C6`);
        const ethereumPM2 = new ethers.Wallet(`0xC18C04743326DB70FF0FB43014B295E3234E7BCB81FF1F4077B4C9CEF9810D9D`);  
        
        // window.decrypt(k1.toHex(), window.encrypt(k1.publicKey.toHex(), data)).toString()

        // console.log(encryptMessage(ethereumPM2.publicKey, 'hello').toString());

        // const message = this.querySelector('#send-a-message-textarea').value;

        const encryptedMessageUint8Array = encryptMessage(ethereumPM1.publicKey, this.store.messageToSend);
        const encryptedMessageSerialized = serializeUint8Array(encryptedMessageUint8Array);

        const swarmHash = await setSwarmContent(encryptedMessageSerialized);

        // console.log('swarmHash', swarmHash);

        this.store.messageHyperlink = `http://localhost:7010/?swarm-hash=${swarmHash}`;

        await sendMessageNotificationTransaction(ethereumPM2.privateKey, ethereumPM1.address, swarmHash);

        // const encryptedMessageDeserialized = deserializeUint8Array(encryptedMessageSerialized);

        // const decryptedMessageUint8Array = decryptMessage(ethereumPM2.privateKey, encryptedMessageDeserialized);
        // const decryptedMessageString = new TextDecoder('utf-8').decode(decryptedMessageUint8Array);

        // console.log('decryptedMessageString', decryptedMessageString);


        // console.log(decryptMessage(ethereumPM2.privateKey, encryptedMessageUint8Array));

        // console.log();

        // console.log(decryptMessage(ethereumPM2.privateKey, encryptMessage(ethereumPM2.publicKey, 'hello')))

        // console.log(new TextDecoder("utf-8").decode(window.eciesjs.decrypt(ethereumPM2.privateKey, window.eciesjs.encrypt(ethereumPM2.publicKey, 'hello'))));

        // console.log(ethereumPM1.publicKey)
    }

    render(state: Readonly<State>) {

        window.localStorage.setItem(EPM_APP_PERSISTED_STATE, JSON.stringify(state));

        return html`
            <style>
                .epm-app-send-message-textarea {
                    width: 500px;
                    height: 250px;
                }
            </style>

            <h1>Ethereum PM - Private messaging with Ethereum and Swarm</h1>

            <h2>This is a prototype that is violating major security best practices</h2>
            <h2>Be careful of using this on the Ethereum main network</h2>

            <div>
                <div>Your Ethereum private key:</div>
                <input
                    type="text"
                    .value=${state.senderEthereumPrivateKey}
                    @input=${(e: any) => this.store.senderEthereumPrivateKey = e.target.value}
                >
            </div>

            <br>

            <div>
                <div>Recipent's Ethereum address:</div>
                <input
                    type="text"
                    .value=${state.receiverEthereumAddress}
                    @input=${(e: any) => this.store.receiverEthereumAddress = e.target.value}
                >
            </div>

            <br>

            <div style="display: flex">
                <div>
                    <div>Send a message:</div>
                    <textarea
                        class="epm-app-send-message-textarea"
                        .value=${state.messageToSend}
                        @input=${(e: any) => this.store.messageToSend = e.target.value}
                    ></textarea>
                    <div>Send this link in Ethereum transaction: ${state.messageHyperlink}</div>
                </div>

                <div>
                    <div>Read a message (will populate when link from Ethereum transaction is visited):</div>
                    <div>${state.messageToReceiveDecrypted}</div>
                </div>
            </div>


            <button @click=${() => this.sendClicked()}>Send</button>
        `;
    }
}

window.customElements.define('epm-app', EPMApp);

async function deriveEthereumPublicKeyFromEthereumAddress(ethereumAddress: string): Promise<string> {

    console.log('ethereumAddress', ethereumAddress);

    const etherscanProvider = new ethers.providers.EtherscanProvider('ropsten');

    const transactionResponses: ReadonlyArray<ethers.providers.TransactionResponse> = await etherscanProvider.getHistory(ethereumAddress);

    const aSignedTransaction: Readonly<ethers.providers.TransactionResponse> | undefined = transactionResponses.find((transactionResponse: Readonly<ethers.providers.TransactionResponse>) => {
        return transactionResponse.from === ethereumAddress;
    });

    if (aSignedTransaction === undefined) {
        throw new Error(`The Ethereum address has no signed transactions`);
    }

    const provider = ethers.getDefaultProvider('ropsten');

    const transactionResponse = await provider.getTransaction(aSignedTransaction.hash);

    console.log('transactionResponse', transactionResponse);

    const signature: string = ethers.utils.joinSignature({
        r: transactionResponse.r,
        s: transactionResponse.s,
        v: transactionResponse.v
    });

    console.log('signature', signature);

    const txData = {
        gasPrice: transactionResponse.gasPrice,
        gasLimit: transactionResponse.gasLimit,
        value: transactionResponse.value,
        nonce: transactionResponse.nonce,
        data: transactionResponse.data,
        chainId: transactionResponse.chainId
    };

    const transaction = await ethers.utils.resolveProperties(txData);
    const rawTransaction = ethers.utils.serializeTransaction(transaction);
    const hashedTransaction = ethers.utils.keccak256(rawTransaction);
    const hashedTransactionBytes = ethers.utils.arrayify(hashedTransaction);
    
    console.log('hashedTransactionBytes', hashedTransactionBytes);

    const publicKey: string = ethers.utils.recoverPublicKey(hashedTransactionBytes, signature)

    console.log('publicKey', publicKey);

    const originalAddress: string = ethers.utils.recoverAddress(hashedTransactionBytes, signature);

    console.log('originalAddress', originalAddress);

    return publicKey;
}

function encryptMessage(publicKey: string, message: string): Uint8Array {
    return (window as any).eciesjs.encrypt(publicKey, message);
}

function decryptMessage(privateKey: string, message: Uint8Array): Uint8Array {
    return (window as any).eciesjs.decrypt(privateKey, message);
}

// TODO my serialization method is probably not optimal and is naive, I'm just trying to get it to work
function serializeUint8Array(uint8Array: Uint8Array) {
    return uint8Array.join(',');
}

function deserializeUint8Array(serializedUint8Array: string): Uint8Array {
    return new Uint8Array(serializedUint8Array.split(',').map((x) => parseInt(x)));
}

async function fetchSwarmContent(swarmHash: string): Promise<string> {
    const response = await window.fetch(`https://swarm-gateways.net/bzz:/${swarmHash}/`);
    return await response.text();
}

async function setSwarmContent(content: string): Promise<string> {
    const response = await window.fetch(`https://swarm-gateways.net/bzz:/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain'
        },
        body: content
    });

    return await response.text();
}

async function sendMessageNotificationTransaction(privateKey: string, toEthereumAddress: string, swarmHash: string) {

    const data = ethers.utils.toUtf8Bytes(`https://ethereumpm.com?swarm-hash=${swarmHash}`);

    const gasLimit = getGasLimit(data, toEthereumAddress, 0);

    // TODO be wary of the nonce
    const transactionData = {
        to: toEthereumAddress,
        value: 0,
        data: ethers.utils.toUtf8Bytes(`https://ethereumpm.com?swarm-hash=${swarmHash}`),
        gasLimit,
        gasPrice: 10 // TODO get the safelow price for real
    };

    const transactionResponse = await new ethers.Wallet(privateKey, ethersProvider).sendTransaction(transactionData);

    console.log('transactionResponse', transactionResponse);
}

async function getGasLimit(dataHex: string, to: string, value: number): Promise<any> {
    return await ethersProvider.estimateGas({
        to,
        value,
        data: dataHex
    });
}