"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebRtcProvider = void 0;
const core_1 = require("@angular/core");
const rxjs_1 = require("rxjs");
let WebRtcProvider = class WebRtcProvider {
    constructor() {
        this.peerConnection = null; // The peer connection between client and host
        this.dataChannel = null; // The data channel between client and host
        this.wsClient = null; // The websocket connection between client and signaling server or host and signaling server
        this.receivedActions$ = new rxjs_1.BehaviorSubject(null); // Whenever an action is received, this observable will emit an event
        this.uuid$ = new rxjs_1.BehaviorSubject(null); // Whenever the UUID is set, it will emit an event (so that the host can set it somewhere in like a QR)
        this.websocketConnectionClosed$ = new rxjs_1.BehaviorSubject(null); // Whenever there is an event on the websocket, this observable will emit
        this.websocketConnectionOpen$ = new rxjs_1.BehaviorSubject(false); // Whenever there is an event on the websocket, this observable will emit
    }
    /**
     * Set the config of the WebRTC connection.
     * Look into the IWebRTCConfig interface for the options
     * @param webRtcConfig The WebRTC configuration
     */
    setConfig(webRtcConfig) {
        this.webRtcConfig = webRtcConfig;
    }
    /**
     * Returns the WebRTC configuration
     */
    getConfig() {
        return this.webRtcConfig;
    }
    /**
     * The client needs to set the host UUID to connect to before setting up the websocket connection
     * @param hostUuid The UUID of the host
     */
    setHostUuid(hostUuid) {
        this.hostUuid = hostUuid;
    }
    /**
     * Send data over the data channel
     * @param action As a string, which action type do you want to send?
     * @param data The data to send as an object
     */
    sendData(action, data) {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            this.dataChannel.send(JSON.stringify(Object.assign({ action }, data)));
        }
        else {
            console.log(`Attempted to send data with action ${action} but data channel is not open`);
        }
    }
    /**
     * Whenever the UUID is set from the host this observable emits
     * @param uuid The UUID to allow clients connec to
     */
    setUuid(uuid) {
        this.uuid$.next(uuid);
    }
    /**
     * Only disconnect on this application and send no disconnect over the data channel
     */
    disconnect() {
        if (this.peerConnection) {
            this.peerConnection.close();
        }
    }
    /**
     * Disconnect on this application and send a disconnect event over the datachannel
     */
    remoteDisconnect() {
        console.log('datachannel:', this.dataChannel);
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            this.dataChannel.send(JSON.stringify({ action: 'disconnect' }));
        }
        this.disconnect();
    }
    /**
     * The host will send an offer when a client connects to his UUID
     * @param peerConnection The peer connection to set the local description
     * @param wsClient The websocket to send the offer to
     */
    sendOffer(peerConnection, wsClient) {
        return __awaiter(this, void 0, void 0, function* () {
            const offer = yield peerConnection.createOffer();
            yield peerConnection.setLocalDescription(offer);
            wsClient.send(JSON.stringify({
                type: 'offer',
                offer
            }));
        });
    }
    /**
     * This method will launch the websocket and listen to events
     */
    launchWebsocketClient() {
        return __awaiter(this, void 0, void 0, function* () {
            const RTCSessionDescription = require('wrtc').RTCSessionDescription;
            const RTCIceCandidate = require('wrtc').RTCIceCandidate;
            const W3CWebSocket = require('websocket').w3cwebsocket;
            let signalingUrl = this.webRtcConfig.signalingUrl;
            if (!signalingUrl) {
                console.log('signalingUrl undefined, falling back to default');
                signalingUrl = 'wss://auth.proofme.id';
            }
            console.log('Connecting to signaling server:', signalingUrl);
            this.wsClient = yield new W3CWebSocket(signalingUrl);
            this.wsClient.onerror = (error => {
                console.log('Websocket error: ' + error.toString());
                this.websocketConnectionClosed$.next(true);
                this.websocketConnectionOpen$.next(false);
            });
            this.wsClient.onclose = (() => {
                console.log('Websocket connection closed');
                this.websocketConnectionClosed$.next(true);
                this.websocketConnectionOpen$.next(false);
            });
            this.wsClient.onopen = (() => {
                console.log('Websocket connection open');
                this.websocketConnectionClosed$.next(false);
                this.websocketConnectionOpen$.next(true);
            });
            this.wsClient.onmessage = ((msg) => __awaiter(this, void 0, void 0, function* () {
                if (msg.data) {
                    let data;
                    // accepting only JSON messages
                    try {
                        data = JSON.parse(msg.data);
                    }
                    catch (e) {
                        console.log('Websocket onmessage ERROR: Invalid JSON');
                        data = {};
                    }
                    const { type, message, success, uuid, offer, answer, candidate, webRtcConnectionConfig } = data;
                    switch (type) {
                        case 'error':
                            // On an error
                            console.log('Websocket onmessage error: ', message);
                            break;
                        case 'connect':
                            console.log('Websocket connect event');
                            console.log('Websocket connect success:', success);
                            // When connected to the Signaling service
                            if (success) {
                                if (this.webRtcConfig.isHost) {
                                    console.log('Websocket connect is host');
                                    // if the application is the host, send a host request to receive a UUID
                                    this.wsClient.send(JSON.stringify({ type: 'host' }));
                                }
                                else {
                                    console.log('Websocket connect is not host');
                                    // If the application is not the host, send a connect request with the host UUID
                                    yield this.setupPeerconnection(this.hostUuid);
                                    this.wsClient.send(JSON.stringify({ type: 'connect', host: this.hostUuid }));
                                }
                            }
                            else {
                                console.log('Websocket onmessage connect failure');
                            }
                            break;
                        case 'connected':
                            console.log('webRtcConnectionConfig:', webRtcConnectionConfig);
                            if (webRtcConnectionConfig) {
                                this.webRtcConnectionConfig = webRtcConnectionConfig;
                            }
                            // When the host received an UUID
                            if (uuid && this.webRtcConfig.isHost) {
                                console.log('Websocket onmessage connected success with client uuid:', uuid);
                                yield this.sendOffer(this.peerConnection, this.wsClient);
                            }
                            break;
                        case 'offer':
                            // If the application is not the host, it receives an offer whenever a client connects.
                            // The client will send an answer back
                            console.log("Received offer");
                            if (offer && !this.webRtcConfig.isHost) {
                                yield this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
                                const hostAnswer = yield this.peerConnection.createAnswer();
                                this.wsClient.send(JSON.stringify({
                                    type: 'answer',
                                    answer: hostAnswer
                                }));
                                yield this.peerConnection.setLocalDescription(hostAnswer);
                            }
                            break;
                        case 'host':
                            console.log("Received host");
                            // Whenever the host receives a host request back, set the UUID provided
                            if (uuid && this.webRtcConfig.isHost) {
                                console.log('Websocket onmessage host waiting for user to connect to ' + uuid);
                                this.setUuid(uuid);
                                yield this.setupPeerconnection(uuid);
                            }
                            break;
                        case 'leave':
                            // Whenever the host or client leaves setup a new connection
                            console.log('Websocket onmessage leave host uuid: ' + uuid);
                            this.setUuid(null);
                            yield this.setupPeerconnection(uuid);
                            break;
                        case 'answer':
                            console.log("Received answer");
                            // The client will send an answer and the host will set it as a description
                            if (answer && this.webRtcConfig.isHost) {
                                yield this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
                            }
                            break;
                        case 'candidate':
                            console.log("Received candidate from client!");
                            console.log("candidate:", candidate);
                            // On receiving an candidate from the client
                            if (candidate) {
                                const clientCandidate = new RTCIceCandidate(candidate);
                                yield this.peerConnection.addIceCandidate(clientCandidate);
                            }
                            break;
                        default:
                            // The default
                            console.error('Websocket onmessage default');
                            break;
                    }
                }
            }));
        });
    }
    /**
     * This method will setup the peerconnection and datachannel
     * It will also emit received actions over an observable
     * @param uuid The UUID to connect to
     */
    setupPeerconnection(uuid) {
        return __awaiter(this, void 0, void 0, function* () {
            this.peerConnection = new RTCPeerConnection(this.webRtcConnectionConfig);
            console.log('settings up peerconnection with uuid:', uuid);
            this.dataChannel = this.peerConnection.createDataChannel(uuid);
            this.peerConnection.addEventListener('datachannel', event => {
                event.channel.onmessage = ((eventMessage) => __awaiter(this, void 0, void 0, function* () {
                    let data;
                    // accepting only JSON messages
                    try {
                        data = JSON.parse(eventMessage.data);
                        // By default this class will only handle the disconnect event. Close the websocket connection and
                        // Start a new one for others to connect
                        switch (data.action) {
                            case 'disconnect':
                                console.log('peerConnection disconnect');
                                this.disconnect();
                                this.launchWebsocketClient();
                                break;
                        }
                        this.receivedActions$.next(data);
                    }
                    catch (e) {
                        console.log('peerConnection ERROR: Invalid JSON');
                        data = {};
                    }
                }));
                event.channel.onopen = (eventMessage) => {
                    console.log('Sending p2p connected!');
                    this.receivedActions$.next({ action: 'p2pConnected', p2pConnected: true });
                };
            });
            this.peerConnection.addEventListener('iceconnectionstatechange', event => {
                if (this.peerConnection.iceConnectionState === 'disconnected') {
                    this.receivedActions$.next({ action: 'p2pConnected', p2pConnected: false });
                    this.peerConnection.close();
                    this.wsClient.send(JSON.stringify({ type: 'leave' }));
                    this.wsClient.close();
                }
            });
            this.peerConnection.addEventListener('icecandidate', (event) => __awaiter(this, void 0, void 0, function* () {
                if (event.candidate) {
                    console.log('**************** Received candidate over peer, sending to signaller');
                    console.log('Candidate', event.candidate);
                    try {
                        const candidate = new RTCIceCandidate(event.candidate);
                        yield this.peerConnection.addIceCandidate(candidate);
                    }
                    catch (e) {
                        console.log('ooops', e);
                    }
                    this.wsClient.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
                }
            }));
        });
    }
};
WebRtcProvider = __decorate([
    core_1.Injectable(),
    __metadata("design:paramtypes", [])
], WebRtcProvider);
exports.WebRtcProvider = WebRtcProvider;
//# sourceMappingURL=webRtc.provider.js.map