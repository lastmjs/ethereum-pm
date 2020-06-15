import { html, render as litRender } from 'lit-html';
import { createObjectStore } from 'reduxular';
import { ethers } from 'ethers';
import '../test.js';
import { origin } from '../modules/constants';

const ethersProvider = ethers.getDefaultProvider('ropsten');

const EPM_APP_PERSISTED_STATE = 'EPM_APP_PERSISTED_STATE';

const aboutText = `
Ethereum PM allows you to send encrypted messages to Ethereum accounts.

No one will be able to decrypt a message sent to an address, unless they own the private key associated with that address.

Messages are encrypted using the public key of the recipient address.

The encrypted message is stored on Ethereum Swarm.

A link with the Swarm hash is sent as the data field in an Ethereum transaction to the recipient address.

The recipient will see a new transaction in MetaMask, Etherscan, or another wallet.

They can then look at the data field, decode it as utf-8, copy the link and paste it into a browser.

If their private key has been entered into the app (very insecure for now, will use MetaMask decryption once v8 is released), they'll be able to read the message.

Only Ethereum addresses that have sent at least one transaction will be able to receive messages.
`;

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

class EPMApp extends HTMLElement {

    readonly store = createObjectStore(InitialState, (state: Readonly<State>) => litRender(this.render(state), this), this);

    async connectedCallback() {
        const swarmHash: string | null = new URLSearchParams(window.location.search).get('swarm-hash');

        if (swarmHash !== null) {
            try {
                const swarmContent = await fetchSwarmContent(swarmHash);
        
                this.store.messageToReceiveEncrypted = swarmContent;
    
                const messageToReceiveDecryptedUint8Array = decryptMessage(this.store.senderEthereumPrivateKey, deserializeUint8Array(swarmContent));
                const messageToReceiveDecryptedString = new TextDecoder('utf-8').decode(messageToReceiveDecryptedUint8Array);
    
                this.store.messageToReceiveDecrypted = messageToReceiveDecryptedString;
            }
            catch(error) {
                // alert('Could not decrypt message');
                // throw new Error(error);
                this.store.messageToReceiveDecrypted = 'Could not decrypt message';    
            }
        }
        else {
            this.store.messageToReceiveEncrypted = '';
            this.store.messageToReceiveDecrypted = '';
        }

        // const ethereumPM1 = new ethers.Wallet(`0x62B29D1AE19BF09856447A165E1DD4EE802726BAF3CDBA38250860B6460921C6`);
        // const ethereumPM2 = new ethers.Wallet(`0xC18C04743326DB70FF0FB43014B295E3234E7BCB81FF1F4077B4C9CEF9810D9D`);  

        // console.log(ethereumPM1.publicKey);
        // console.log(ethereumPM2.publicKey);
    }

    async sendClicked() {

        if (this.store.receiverEthereumPublicKey === '') {
            console.log('calculating public key');
            const receiverEthereumPublicKey: string = await deriveEthereumPublicKeyFromEthereumAddress(this.store.receiverEthereumAddress);
            this.store.receiverEthereumPublicKey = receiverEthereumPublicKey;
        }

        const encryptedMessageUint8Array: Uint8Array = encryptMessage(this.store.receiverEthereumPublicKey, this.store.messageToSend);
        const encryptedMessageSerialized: string = serializeUint8Array(encryptedMessageUint8Array);

        const swarmHash: string = await setSwarmContent(encryptedMessageSerialized);

        this.store.messageHyperlink = `${origin}?swarm-hash=${swarmHash}`;

        const result: 'SUCCESS' | {} = await sendMessageNotificationTransaction(`0x${this.store.senderEthereumPrivateKey}`, this.store.receiverEthereumAddress, swarmHash);

        if (result === 'SUCCESS') {
            alert('Message sent');
        }
        else {
            alert('Message failed to send');
            throw new Error(result.toString());
        }
    }

    render(state: Readonly<State>) {

        window.localStorage.setItem(EPM_APP_PERSISTED_STATE, JSON.stringify(state));

        return html`
            <style>
                html {
                    margin: 0;
                    padding: 0;
                    height: 100%;
                    width: 100%;
                    font-family: sans-serif;
                }

                body {
                    margin: 0;
                    padding: 0;
                    height: 100%;
                    width: 100%;
                }

                a {
                    color: black;
                }

                .epm-app-main-container {
                    height: 100%;
                    width: 100%;
                    box-sizing: border-box;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    /* background-color: rgba(0, 0, 0, .25); */
                    background: linear-gradient(black, grey);
                }

                .epm-app-secondary-container {
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    width: 50%;
                    align-items: center;
                    box-sizing: border-box;
                    background-color: white;
                    overflow-y: scroll;
                    padding: 25px;
                }

                @media (max-width: 1280px) {
                    .epm-app-secondary-container {
                        width: 100%;
                    }
                }

                .epm-app-send-message-textarea {
                    font-size: 15px;
                    width: 75%;
                    height: 25vh;
                    resize: none;
                    border: solid 2px rgba(0, 0, 0, .5);
                    border-radius: 5px;
                    padding-left: 25px;
                    padding-top: 10px;
                    box-sizing: border-box;
                }

                .epm-app-read-message {
                    font-size: 15px;
                    width: 75%;
                    height: 25vh;
                    /* border: solid 2px rgba(0, 0, 0, .5); */
                    border-radius: 5px;
                    padding-left: 25px;
                    padding-top: 10px;
                    box-sizing: border-box;
                }

                .epm-app-input-container {
                    width: 75%;
                    box-sizing: border-box;
                    padding-left: 25px;
                    padding-right: 25px;
                    padding-bottom: 10px;
                    padding-top: 10px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    background-color: rgba(0, 0, 0, .1);
                    border-radius: 5px;
                    border-bottom: solid 2px rgba(0, 0, 0, .5);
                }

                .epm-app-input {
                    width: 100%;
                    font-size: 20px;
                    border: none;
                    background: none;
                }

                .epm-app-input-title {
                    font-size: 15px;
                    align-self: flex-start;
                }

                .epm-app-button {
                    padding-left: 50px;
                    padding-right: 50px;
                    padding-top: 10px;
                    padding-bottom: 10px;
                    font-size: 20px;
                    background: none;
                    border: solid 2px rgba(0, 0, 0, .5);
                    border-radius: 5px;
                    cursor: pointer;
                }
            </style>

            <div class="epm-app-main-container">
                <div class="epm-app-secondary-container">
                    <div style="width: 100%; font-size: 25px; font-weight: bold">
                        <a href="/" style="text-decoration: none">Ethereum PM</a>
                    </div>

                    <hr style="width: 75%">

                    <div>
                        <a href="" @click=${() => alert(aboutText)}>About</a>
                        <a href="/oss-attribution/attribution.txt" target="_blank">Open Source</a>
                    </div>
        
                    <br>

                    <div style="color: red" ?hidden=${state.messageToReceiveDecrypted !== ''}>This is a prototype that is violating major security best practices</div>
                    <div style="color: red" ?hidden=${state.messageToReceiveDecrypted !== ''}>Only runs on Ropsten for now</div>
                    <div style="color: red" ?hidden=${state.messageToReceiveDecrypted !== ''}>Never entire a private key into this app with real funds</div>

                    <br>
        
                    <div class="epm-app-input-container">
                        <div class="epm-app-input-title">Your Ethereum private key</div>
                        <input
                            class="epm-app-input"
                            type="text"
                            .value=${state.senderEthereumPrivateKey}
                            @input=${(e: any) => this.store.senderEthereumPrivateKey = e.target.value}
                        >
                    </div>
        
                    <br>
        
                    <div class="epm-app-input-container" style="display: ${state.messageToReceiveDecrypted === '' ? 'flex' : 'none'}">
                        <div class="epm-app-input-title">Recipent's Ethereum address:</div>
                        <input
                            class="epm-app-input"
                            type="text"
                            .value=${state.receiverEthereumAddress}
                            @input=${(e: any) => {
                                this.store.receiverEthereumAddress = e.target.value;
                                this.store.receiverEthereumPublicKey = '';
                            }}
                        >
                    </div>
        
                    <br>
        
                    <div style="width: 100%; display: flex; justify-content: center">
                        <div style="width: 100%; display: ${state.messageToReceiveDecrypted === '' ? 'flex' : 'none'}; flex-direction: column; align-items: center">
                            <textarea
                                class="epm-app-send-message-textarea"
                                .value=${state.messageToSend}
                                @input=${(e: any) => this.store.messageToSend = e.target.value}
                                placeholder="Type your message"
                            ></textarea>
                            <br>
                            <div style="width: 75%;" ?hidden=${state.messageHyperlink === ''}><input style="width: 100%" type="text" .value=${state.messageHyperlink}></div>
                        </div>
        
                        <div style="width: 100%; display: ${state.messageToReceiveDecrypted === '' ? 'none' : 'flex'}; flex-direction: column; align-items: center">
                            <div class="epm-app-read-message">${state.messageToReceiveDecrypted}</div>
                        </div>
                    </div>

                    <br>
                
                    <button
                        ?hidden=${state.messageToReceiveDecrypted !== ''}
                        class="epm-app-button"
                        @click=${() => this.sendClicked()}
                    >
                        Send
                    </button>
        
                    <br>
                    <br>
                    <br>

                    <div ?hidden=${state.messageToReceiveDecrypted !== ''}>Powered by Etherscan.io APIs</div>

                </div>
            </div>
        `;
    }
}

window.customElements.define('epm-app', EPMApp);

async function deriveEthereumPublicKeyFromEthereumAddress(ethereumAddress: string): Promise<string> {

    console.log('ethereumAddress', ethereumAddress);

    // TODO we want to somehow get rid of this dependency on Etherscan...wait, I wonder if GraphProtocol will have something for this
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
        chainId: transactionResponse.chainId,
        to: transactionResponse.to
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

async function sendMessageNotificationTransaction(privateKey: string, toEthereumAddress: string, swarmHash: string): Promise<'SUCCESS' | {}> {
    try {
        const data = ethers.utils.toUtf8Bytes(`${origin}?swarm-hash=${swarmHash}`);

        const gasLimit = getGasLimit(data, toEthereumAddress, 0);
    
        // TODO be wary of the nonce
        const transactionData = {
            to: toEthereumAddress,
            value: 0,
            data,
            gasLimit,
            gasPrice: 10 // TODO get the safelow price for real
        };
    
        const transactionResponse = await new ethers.Wallet(privateKey, ethersProvider).sendTransaction(transactionData);
    
        console.log('transactionResponse', transactionResponse);
    
        return 'SUCCESS';
    }
    catch(error) {
        return error;
    }
}

async function getGasLimit(dataHex: string, to: string, value: number): Promise<any> {
    return await ethersProvider.estimateGas({
        to,
        value,
        data: dataHex
    });
}