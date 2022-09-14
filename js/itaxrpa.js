/*
 * 제작: NTM.
 * 버전: 0.1
 * 스크린 스크래핑 엔진.
 * IE는 Promise 사용을 위해 bluebird.min.js 사용바람니다.(IE 버전 11 미만 지원불가)
 * 소스코드를 절대 변경하지 마세요.
 */

var _engine = new function () {

    var apiServer = 'https://127.0.0.1:39802';

    // rpa.exe 로컬 서버 api 호출.
    function request(url, param, method, _async) {
        _async = (_async == undefined) ? true : _async;
        return new Promise(function (resolve, reject) {
            var xhr = new XMLHttpRequest();
            try {
                xhr.onerror = function (e) { reject(e); };
                xhr.open(method, url, _async);
                xhr.send(JSON.stringify(param));
                xhr.onreadystatechange = function (e) {
                    if (xhr.readyState == XMLHttpRequest.DONE) {
                        if (xhr.status == 200) {
                            resolve(xhr.responseText);
                        } else {
                            //console.log(JSON.stringify(param));
                            reject('[오류 01] 전송에 실패하였습니다.\n' + xhr.statusText);
                        }
                    }
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    function Queue() {
        var _arr = [];
        this.length = 0;
        this.enqueue = function (item) {
            _arr.push(item);
            this.length = _arr.length;
        }
        this.dequeue = function() {
            var s = _arr.shift();
            this.length = _arr.length;
            return s;
        }
        this.clear = function () {
            _arr = [];
        }
    }

    // 브라우저 제어
    this.rpa = new function () {
        var socket = null;
        var msgCallbacks = [];
        var cb = null;
   
        this.tabId = 0;
        this.queue = new Queue();

        this.on = function (type, listener) {
            msgCallbacks.push(listener);
            socket.addEventListener(type, listener);
        }

        this.off = function (type) {
            msgCallbacks.forEach(function (evt) { socket.removeEventListener(type, evt) });
        }
        
        this.createSocket = function (bNoti, callback) {
            var that = this;
            cb = callback;
            return new Promise(function (resolve, reject) {
                socket = new WebSocket('wss://127.0.0.1:39803/event');
                socket.onopen = function () { resolve(); };
                socket.onmessage = function (event) {
                    try {
                        var data = JSON.parse(event.data);
                        if (data.event == 'created') {
                            that.tabId = data.tab.id;
                        } else if (that.tabId == 0 && data.changeInfo.status == "loading") {
                            that.tabId = data.tabId;
                        } else if (data.event == 'complete') {
                            that.queue.enqueue(data);
                        } else if (data.event == 'removed') {
                            //console.log(JSON.stringify(data));
                        }
                    } catch (e) { //
                    }
                }
                socket.onclose = function (event) {
                    if (event.wasClean) {
                        //console.log(`[close] 커넥션이 정상적으로 종료되었습니다(code=${event.code} reason=${event.reason})`);
                    } else {
                        // 예시: 프로세스가 죽거나 네트워크에 장애가 있는 경우
                        // event.code가 100`이 됩니다.
                        //console.log('[close] 커넥션이 죽었습니다.');
                        reject('[close] socket error (code=' + event.code + ' reason=' + event.reason + ')');
                    }
                };
                socket.onerror = function (error) {
                    reject(JSON.stringify(error, ["message", "arguments", "type", "name"]));
                };
            }).then(function () {
                if (cb) cb(socket.readyState);
                if (null != socket && socket.readyState == 1) socket.send(JSON.stringify({ event: 'succeed', src: 'rpa.js >> createSocket' }));
            }).catch(function (error) {
                if (bNoti) {
                    if (confirm('[error] ' + error + '\r\n소켓연결에 실패하였습니다.\n다시 연결하겠습니까?')) {
                        location.reload();
                    }
                } else {
                    new Error(error);
                }
            });
        }

        this.closeSocket = function () {
            if (null != socket) socket.close();
        }

        this.getSocketState = function () {
            /*  Value   State       Description
             *  0       CONNECTING  소켓이 생성되었다. 연결이 아직 열려 있지 않다.
             *  1       OPEN        연결이 열려 있고, 통신할 준비가 되었다.
             *  2       CLOSING     연결이 닫히는 중이다.
             *  3       CLOSED      연결이 닫혔거나 열 수 없었다.
             */
            return socket.readyState;
        }

        this.checkServer = function () {
            return request(apiServer + "?_t=" + new Date().getTime(), '', "GET");
        }

        this.getBrowser = function() {
            var ua = navigator.userAgent;
            return (ua.indexOf('Edg') > -1) ? 'EDGE' : (ua.indexOf('Chrome') > -1) ? 'CHROME' : 'EDGE';
        }

        /**
         * 설치된 각종 파일의 버전을 가져옵니다.(rpa.exe, hspcpp.dll)
         * @param {string} file 파일 이름
         * @returns {any} 버전 데이터
         */
        this.getPluginVersion = function (file) {
            file = encodeURIComponent(file);
            return new Promise(function (resolve, reject) {
                return request(apiServer + "/version?file=" + file + "&_t=" + new Date().getTime(), '', "GET")
                    .then(function (data) { resolve(JSON.parse(data)); })
                    .catch(function (error) { reject(error); })
            });
        }

        /**
         * 배포 버전을 가져옵니다.
         * @param {string} url 버전 파일 웹 주소
         * @returns {any} 버전 데이터
         */
        this.getUpdateVersion = function (url) {
            return new Promise(function (resolve, reject) {
                return request(url + "?_t=" + new Date().getTime(), '', "GET")
                    .then(function (data) { resolve(JSON.parse(data)); })
                    .catch(function (error) { reject(error); })
            });
        }

        this.updateEngine = function (cab) {
            cab = encodeURIComponent(cab);
            return new Promise(function (resolve, reject) {
                return request(apiServer + "/update?cab=" + cab + "&_t=" + new Date().getTime(), '', "GET")
                    .then(function (data) { resolve(JSON.parse(data)); })
                    .catch(function (error) { reject(error); })
            });
        }

        // rpa.exe stop. Setup.msi install
        this.stopServer = function () {
            return request(apiServer + "/stop?t=" + new Date().getTime(), '', "GET");
        }

        this.getKeybdState = function (vKey) {
            return new Promise(function (resolve, reject) {
                return request(apiServer + "/api", { action: "GetKeybdState", params: { 0: vKey } }, "POST")
                    .then(function (data) { resolve(JSON.parse(data)); })
                    .catch(function (error) { reject(error); })
            });
        }

        // IE not working. IE지원 불가.
        this.getHanMode = function () {
            return new Promise(function (resolve, reject) {
                return request(apiServer + "/api", { action: "GetHanMode", params: {} }, "POST")
                    .then(function (data) { resolve(JSON.parse(data)); })
                    .catch(function (error) { reject(error); })
            });
        }

        this.sendKeys = function (str) {
            return request(apiServer + "/api", { action: "SendKeys", params: { 0: str } }, "POST");
        }

        this.keyboardEvent = function (bVk, bScan, dwFlags, dwExtraInfo) {
            return request(apiServer + "/api", { action: "KeyboardEvent", params: { 0: bVk, 1: bScan, 2: dwFlags, 3: dwExtraInfo } }, "POST");
        }

        this.mouseEvent = function (dwFlags, dx, dy, dwData, dwExtraInfo) {
            return request(apiServer + "/api", { action: "MouseEvent", params: { 0: dwFlags, 1: dx, 2: dy, 3: dwData, 4: dwExtraInfo } }, "POST");
        }

        this.getPerformance = function (url) {
            return new Promise(function (resolve, reject) {
                return request(apiServer + "/api", { action: "GetPerformance", params: { 0: url } }, "POST")
                    .then(function (data) { resolve(JSON.parse(data)); })
                    .catch(function (error) { reject(error); })
            });
        }

        this.checkChromiumRPA = function (browser) {
            return request(apiServer + "/api", { action: "CheckChromiumRPA", params: { 0: browser } }, "POST");
        }

        this.installChromiumRPA = function (browser) {
            return request(apiServer + "/api", { action: "InstallChromiumRPA", params: { 0: browser } }, "POST");
        }

        this.chromiumEvent = function (enable) {
            this.tabId = 0;
            this.queue.clear();
            return request(apiServer + "/api", { action: "ChromiumEvent", params: { 0: enable } }, "POST");
        }

        this.edgeInstallPath = function () {
            return request(apiServer + "/api", { action: "EdgeInstallPath", params: {} }, "POST");
        }

        this.chromeInstallPath = function () {
            return request(apiServer + "/api", { action: "ChromeInstallPath", params: {} }, "POST");
        }

        this.chromiumOpen = function (url, cmdArgs, nCodePage, browser) {
            cmdArgs = cmdArgs || "";
            nCodePage = nCodePage || 65001;
            browser = browser || _engine.rpa.getBrowser();
            return new Promise(function (resolve, reject) {
                request(apiServer + "/api", { action: "ChromiumOpen", params: { 0: url, 1: cmdArgs, 2: nCodePage, 3: browser } }, "POST")
                    .then(function (response) {
                        var data = JSON.parse(response);
                        if (data.result == 0) {
                            reject('[error] chromium Open failed.');
                        } else {
                            resolve(data.result);
                        }
                    })
                    .catch(function (error) {
                        reject(error);
                    });
            });
        }

        this.chromiumTabRemove = function (tabId) {
            this.tabId = 0;
            return request(apiServer + "/api", { action: "ChromiumTabRemove", params: { 0: tabId } }, "POST");
        }

        this.chromiumExecuteScript = function (tabId, code) { // 서버에서 WaitForSingleObject or mutex lock 처리하므로 중복실행 불가.
            return new Promise(function (resolve, reject) {
                setTimeout(function () {
                    request(apiServer + "/api", { action: "ChromiumExecuteScript", params: { 0: tabId, 1: code  } }, "POST")
                        .then(function (response) {
                            var data = JSON.parse(response);
                            if (undefined == data.error) {
                                resolve(data);
                            } else {
                                reject(data.error);
                            }
                        })
                        .catch(function (error) {
                            reject(error);
                        });
                }, 300);
            });
        }

        this.chromiumExecuteScriptEx = function (tabId, code, timeout) {
            timeout = timeout || 3;
            return this.chromiumExecuteScript(tabId, "localStorage.removeItem('__ret');(function(){ var doc=document,s=doc.createElement('script');s.text=\"var __ret= " + code + ";localStorage['__ret']=JSON.stringify({ ret: __ret })\";s.type='text/javascript';(document.head||document.documentElement).appendChild(s); return JSON.parse(localStorage['__ret']).ret; })();", timeout);
        }

        this.chromiumExecuteScriptWaitForKeyword = function (tabId, code, keyword, timeout) {
            var that = this;
            var cnt = 0, total = 0;
            timeout = timeout || 3;
            total = timeout * 2;

            return new Promise(function (resolve, reject) {
                var exec = function () {
                    if (cnt++ >= total) {
                        reject("[error] '" + keyword + "' not found.");
                    }
                    that.chromiumExecuteScript(tabId, code)
                        .then(function (data) {
                            if (null != data.result && String(data.result).indexOf(String(keyword)) > -1) {
                                resolve(true);
                            } else {
                                setTimeout(exec, 500);
                            }
                        })
                        .catch(function (error) {
                            reject(error);
                        });
                }
                setTimeout(exec, 500);
            });
        }

        this.injectJquery = function (tabId) {
            return this.chromiumExecuteScript(
                (undefined == tabId) ? this.tabId : tabId,
                "if(undefined == window.$){var doc=document,s=doc.createElement('script');s.type='text/javascript';s.src=chrome.extension.getURL('js/jquery-3.6.0.min.js');(document.head||document.documentElement).appendChild(s);}"
            );
        }

        this.chromiumNavigate = function (tabId, action, param, method, enctype) { // 호출 후 waitForCompleted 필히 호출
            this.queue.clear();
            enctype = enctype || "text/plain";
            param = param.replace(/\\/g, "\\\\").replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/\t/g, "\\t").replace(/\f/g, "\\f").replace(/\v/g, "\\v").replace(/\0/g, "\\0");
            return this.chromiumExecuteScript(
                tabId,
                "var _i, _r, _t = '" + enctype + "', _b = _t.toLowerCase().indexOf('application/x-www-form-urlencoded') > -1, _re = /([^&=]+)=([^&]+)/gm;var _f = document.createElement('form');_f.setAttribute('method', '" + method + "');_f.setAttribute('action', '" + action + "');_f.setAttribute('enctype', _t);while (_r = _re.exec('" + param + "')) {_i = document.createElement('input');_i.setAttribute('type', 'hidden');_i.setAttribute('name', _b ? decodeURIComponent(_r[1]) : _r[1]);_i.setAttribute('value', _b ? decodeURIComponent(_r[2]) : _r[2]);_f.appendChild(_i);}(document.head || document.documentElement).appendChild(_f);_f.submit();"
            );
        }

        this.waitForCompleted = function (url, timeout) {
            var that = this;
            var cnt = 0, total = 0;
            timeout = timeout || 3;
            total = timeout * 2;
            return new Promise(function (resolve, reject) {
                var data = null;
                var interval = setInterval(function () {
                    if (cnt++ >= total) {
                        clearInterval(interval);
                        reject('[error] Wait timeout.\n' + url);
                    }
                    while (that.queue.length > 0) {
                        data = that.queue.dequeue();
                        if (null != data && data.tab.url.indexOf(url) > -1) {
                            clearInterval(interval);
                            resolve(data.tabId);
                            break;
                        }
                    }
                }, 500);
            });
        }

        this.checkRPA = function (browser) {
            var that = this;
            return new Promise(function (resolve, reject) {
                that.checkChromiumRPA(browser)
                    .then(function (res) {
                        var data = JSON.parse(res);
                        if (data.error) {
                            reject(data.error); return;
                        }
                        switch (data.result) {
                            case 1: // 모두 설치됨.
                                resolve();
                                break;
                            case -1:
                            case -2:
                                alert("웹브라우저(Chrome, Edge)를 설치해 주세요.");
                                break;
                            case -3:
                                that.installChromiumRPA(browser)
                                    .then(function () {
                                        // 확장 미설치 알림시 native messaging host 설치
                                        var extensionUrl = browser == "EDGE"
                                            ? "https://microsoftedge.microsoft.com/addons/detail/itax-rpa/honmieblhomlpehdbihphffpoplimnof"
                                            : "https://chrome.google.com/webstore/detail/itax-rpa/lcijbmfmecmcjgklcpigckahloniopel";
                                        window.open(extensionUrl, "_blank");
                                    });
                                break;
                            case -4:
                            case -5:
                            case -6:
                            case -7:
                            case -8:
                                that.installChromiumRPA(browser)
                                    .then(function (res) {
                                        var data = JSON.parse(res);
                                        if (data.result == 1) {
                                            // 모두 설치 성공
                                            resolve();
                                        }
                                    })
                                    .catch(function () { reject('RPA 설치 실패.'); });
                                break;
                        }
                    })
                    .catch(function (e) {
                        reject('RPA 설치 실패.\n' + e);
                    });
            });
        }

        this.apps = function (name) {
            return request(apiServer + "/apps", { action: name, params: {} }, "POST");
        }

        /**
         * rpa.exe 프로세스가 있으면 소켓 연결합니다.
         * @param {initializeCallback} callback 버전 파일 웹 주소
         */
        this.initialize = function (callback) {
            var that = this;
            return this.checkServer()
                .then(function () {
                    return that.createSocket(true);
                })
                .catch(function () {
                    callback();
                });
        }
    } // rpa

    // 스크래핑 엔진
    this.api = new function () {
        /**
         * 2. 엔진 사용승인
         */
        this.signIn = function (identityCode, password) {
            return new Promise(function (resolve, reject) {
                request(apiServer + "/api", { action: "SignIn", params: { 0: identityCode, "1": password } }, "POST")
                    .then(function (data) { resolve(JSON.parse(data)); })
                    .catch(function (error) { reject(error); })
            });
        }

        /**
         * 3. 엔진 사용종료
         */
        this.signOut = function () {
            return new Promise(function (resolve, reject) {
                request(apiServer + "/api", { action: "SignOut", params: {} }, "POST")
                    .then(function (data) { resolve(data); })
                    .catch(function (error) { reject(error); })
            });
        }

        /**
         * 4. 스토리지 목록
         */
        this.selectStorageInfo = function () {
            return new Promise(function (resolve, reject) {
                request(apiServer + "/api", { action: "SelectStorageInfo", params: {} }, "POST")
                    .then(function (data) { resolve(JSON.parse(data)); })
                    .catch(function (error) { reject(error); })
            });
        }

        /**
         * 5. 인증서 목록
         */
        this.getCertList = function (diskname) {
            return new Promise(function (resolve, reject) {
                request(apiServer + "/api", { action: "GetCertList", params: { 0: diskname } }, "POST")
                    .then(function (data) { resolve(JSON.parse(data)); })
                    .catch(function (error) { reject(error); })
            });
        }
    }
}

