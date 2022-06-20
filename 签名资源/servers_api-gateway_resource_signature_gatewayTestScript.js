var SignUtil={
    /*
    使用前须在postman脚本中添加如下header变量:
    content-md5:        {{Md5}}
    nonce:              {{Nonce}}
    app-key:            {{AppKey}}
    signature:          {{Signature}}
    signature-headers:  {{SignatureHeaders}}
    timestamp:          {{timestamp}}
    */
    sign: function () {
        // 测试用的secret，直接写死在程序里面了，以后做数据库再说
        var appKey = "Tester-Key";
        var appSecret = "f554a080655952d8354d42d0ef1ec4b0175239e5";

        // 简单模式的签名串，去掉时间信息date和随机盐nonce
        // md5针对body为对象（目前只用了Json）使用Base64+MD5形成摘要，body为表单的直接返回空字符串
        var md5 = this.calcMd5();
        var date = this.createDate();
        var nonce = this.createUuid();
        var timeStamp = this.createTimeStamp();

        var textToSign = "";
        var contentType = "";

        if(request.headers["content-type"]){
            contentType = request.headers["content-type"];
        }

        // 第一部分：标准Header待签串
        // 注意，标准Header待签串中使用的header不能以X-Ca-开头，否则会重复签名
        textToSign += request.method + "\n";
        textToSign += md5 + "\n";
        textToSign += contentType + "\n";
        textToSign += timeStamp + "\n";
        textToSign += nonce + "\n";
        textToSign += appKey + "\n";

        // 第二部分：自定义Header待签串
        // 除了将相应的header添加到待签串当中外，还需伴随生成X-Ca-Signature-Headers字段
        // 以与自定义Header待签串中(key-value)相同的顺序，形如：key1,key2,...,keyn保存参与计算的key值
        var headers = this.headersToSign();
        var signatureHeaders;
        var sortedKeys = Array.from(headers.keys()).sort()
        for (i = 0; i < sortedKeys.length; i++) {
            headerName=sortedKeys[i]
            textToSign += headerName + ":" + headers.get(headerName) + "\n";
            signatureHeaders = signatureHeaders ? signatureHeaders + "," + headerName : headerName;
        }

        textToSign += this.urlToSign();

        console.log("\n **************************************************** \n");
        console.log("textToSign/Raw\n------------------------\n" + textToSign);
        var hash = CryptoJS.HmacSHA256(textToSign, appSecret)
        console.log("hash:" + hash)
        var signature = hash.toString(CryptoJS.enc.Base64)
        console.log("signature:" + signature)

        // 向Postman的报文header中写相应的Value字段
        pm.environment.set('AppKey', appKey);
        pm.environment.set('Md5', md5);
        pm.environment.set("Signature", signature);
        pm.environment.set("SignatureHeaders", signatureHeaders);
        pm.environment.set("Nonce", nonce);
        pm.environment.set("TimeStamp", timeStamp);
    },

// 自定义地添加一些标准Header以外的、参与签名的header
// 对参与签名的Header命名没有要求，但是为了方便编码与调试，建议使用X-Ca-[name]的方式
// 重要报文信息也应当放在X-Ca-[name]的字段中
    headersToSign: function() {
        var prefix = "x-ca-"
        var headers = new Map();
        for (var name in request.headers) {
            // postman设置？request.headers中元素全为小写，故此处程序相应调整（但后端服务器区分大小写）
            name = name.toLowerCase();
            // 跳过签名和签名头两个特殊header，避免重复计算
            // console.log("header loop on: " + name);
            if(name.startsWith(prefix)){
                var value = request.headers[name];
                console.log("header addons: key = " + name + "value = " + value);
                headers.set(name, value);
            }
        }
        return headers;
    },

    urlToSign: function() {
        var params = new Map();
        var contentType = request.headers["content-type"];
        // 针对表单，使用k1=v1&k2=&k3=v3 ... 的格式构造字符串
        if (contentType && contentType.startsWith('application/x-www-form-urlencoded')) {
            for(x in request.data){
                params.set(x, request.data[x]);
            }
        }
        var queryParam = pm.request.url.query.members;
        // [重要！]key-value对必须以key值排序！
        for (i in queryParam) {
            params.set(queryParam[i].key, queryParam[i].value);
        }
        var sortedKeys = Array.from(params.keys())
        sortedKeys.sort();
        var url = "";
        for(i = 0; i < pm.request.url.path.length; i++){
            k=pm.request.url.path[i];
            url = url + "/" + k;
        }
        var qs;
        for (i = 0; i < sortedKeys.length; i++) {
            k=sortedKeys[i];
            var s = k + "=" + params.get(k);
            qs = qs ? qs + "&" + s : s;
            // console.log("key=" + k + " value=" + params.get(k));
        }
        return qs ? url + "?" + qs : url;
    },

// 针对对象（目前只做了Json），采用Base64+MD5的计算方式形成摘要
    calcMd5: function() {
        var contentType = String(request.headers["content-type"]);
        if (!JSON.stringify(request.data).startsWith('{}') && !contentType.startsWith('application/x-www-form-urlencoded')) {
            var data = request.data;
            var md5 = CryptoJS.MD5(data);
            var md5String = md5.toString(CryptoJS.enc.Base64);
            return md5String;
        } else {
            return "";
        }
    },

    createUuid: function() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
            return v.toString(16);
        });
    },

    createDate: function(){
        var ret = "";
        var date = new Date();
        ret += date.getFullYear().toString();
        ret += "-";
        ret += (date.getMonth()+1).toString();
        ret += "-";
        ret += (date.getDate()).toString();
        return ret;
    },

    createTimeStamp: function(){
        return (Date.now() - 10 * 1000).toString();
    }
}
