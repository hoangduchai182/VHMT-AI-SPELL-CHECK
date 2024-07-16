/**
 *
 * (c) Copyright Ascensio System SIA 2020
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
(function(window, undefined){

	let txt = "";
    let editor, editor_response; // Trình soạn thảo html

	window.Asc.plugin.init = async function(text)
	{
		let settings = {
			embeddedLanguageFormatting: "off",
			htmlWhitespaceSensitivity: "ignore",
			insertPragma: false,
			printWidth: 999999999999,
			proseWrap: "never",
			requirePragma: false,
			singleQuote: false,
			tabWidth: 4,
			useTabs: true,
			vueIndentScriptAndStyle: false,
			plugins: prettierPlugins,
			parser: "html"
		};
		text = text.replace(/class="[a-zA-Z0-9-:;+"\/=]*/g,"");
		let temp = (text.indexOf("<p") === -1) ? "\r\n" : ""
		if (text !== ""){
			text = prettier.format(temp + text, settings);
        }

        if (editor) { // Cập nhật nội dung cho trình soạn thảo html
			editor.setValue(text);
		}

		if (!editor) { // Khởi tạo trình soạn thảo html
			editor = CodeMirror(document.getElementById("textarea-html"), {
				mode: "text/html",
				value: text,
				lineWrapping: false
			});
		}

        if (!editor_response) { // Khởi tạo trình soạn thảo phản hồi html
            editor_response = CodeMirror(document.getElementById("result-html"), {
                mode: "text/html",
                value: "",
                lineWrapping: false
            });
        }

		txt = text; // Lưu nội dung văn bản được bôi đen vào biến txt
		savedDismiss = []; // Mảng chứa các đoạn văn bản đã được xử lý
		switch (window.Asc.plugin.info.editorType) {
            case 'word': 
            case 'slide': {
                window.Asc.plugin.executeMethod("GetSelectedText", [{Numbering:false, Math: false, TableCellSeparator: '\n', ParaSeparator: '\n', TabSymbol: String.fromCharCode(160)}], function(data) {
                    txt = (data === undefined) ? "" : data.replace(/\r/g, ' ');
                    ExecPlugin();
                });
				break;
            }
            case 'cell': 
                window.Asc.plugin.executeMethod("GetSelectedText", [{Numbering:false, Math: false, TableCellSeparator: '\n', ParaSeparator: '\n', TabSymbol: String.fromCharCode(160)}], function(data) {
                    if (data == '')
                        txt = txt.replace(/\r/g, ' ').replace(/\t/g, '\n'); 
                    else if (data !== undefined) {
                        txt = data.replace(/\r/g, ' ');
                    }
                    ExecPlugin();
                });
			break;
        }

        let response_text;
        // hệ thống các nút bấm và sự kiện
        document.getElementById("check-gpt").onclick = async function() {
            // nút gửi yêu cầu đến API
            if (text == "" || text == undefined) {
                document.getElementById("warning-message").style.display = "block";
            } else {
                // Hiển thị dòng chữ thông báo
                document.getElementById("count-percent").innerHTML = "0%";
                document.getElementById("processing-message").style.display = "block";
                
                // Gửi yêu cầu đến GPT
                response_text = await processTextInChunks(text, settings);
            
                // Ẩn dòng chữ thông báo khi có kết quả trả về
                document.getElementById("processing-message").style.display = "none";
            
                // Hiển thị kết quả trả về trong trình soạn thảo phản hồi
                document.getElementById("result").innerText = getHtml(response_text);
                if (editor_response) {
                    editor_response.setValue(response_text);
                }
            }

        };
        document.getElementById("btn_paste").onclick = function() {
            // nút dán kết quả vào văn bản
            if (response_text == "" || response_text == undefined) {
                document.getElementById("warning-message").style.display = "block";
            } else  {
                // Dán kết quả vào văn bản và clear hết dữ liệu
                window.Asc.plugin.executeMethod("PasteHtml",[`<html><body>${response_text}</body></html>`]);
                // clearData();
            }
		};
        document.getElementById("btn_paste_end").onclick = function() {
            // nút dán kết quả vào cuối văn bản
            if (response_text == "" || response_text == undefined) {
                document.getElementById("warning-message").style.display = "block";
            } else  {
                window.Asc.plugin.executeMethod ("MoveCursorToEnd", [true]);
                window.Asc.plugin.executeMethod("PasteHtml",[`<html><body>${response_text}</body></html>`]);
                // clearData();
            }
		};
        document.getElementById("clear").onclick = function() {
            // nút xóa hết dữ liệu
            clearData();
        };
        document.getElementById("warning-message").onclick = function() {
            document.getElementById("warning-message").style.display = "none";
		};
        document.getElementById("tab-text").onclick = function() {
            showTabContent('textarea', "tab-text");
        };
        document.getElementById("tab-html").onclick = function() {
            showTabContent('textarea-html', "tab-html");
        };
        document.getElementById("tab-res-text").onclick = function() {
            showTabContent('result', "tab-res-text");
        };
        document.getElementById("tab-res-html").onclick = function() {
            showTabContent('result-html', "tab-res-html");
        };
        
        function clearData() {
            // Xóa hết dữ liệu
            response_text = "";
            editor.setValue("");
            editor_response.setValue("");
            document.getElementById("textarea").innerText = "";
            document.getElementById("result").innerText = "";
        }
	};


    async function processTextInChunks(text, settings) {
        let list_text = splitHtml(text);
        let processedChunks = []; // Mảng chứa các đoạn được trả về
        for (let text_element of list_text) {
            let hasPTag = /<p[^>]*>/.test(text_element); // Kiểm tra văn bản có chứa thẻ <p> không
            let hasOlTag = /<ol[^>]*>/.test(text_element); // Kiểm tra văn bản có chứa thẻ <ol> không
            let hasUlTag = /<ul[^>]*>/.test(text_element); // Kiểm tra văn bản có chứa thẻ <ul> không
            let hasTableTag = /<table[^>]*>/.test(text_element); // Kiểm tra văn bản có chứa thẻ <table> không

            document.getElementById("count-part").innerHTML = `${list_text.indexOf(text_element) + 1} / ${list_text.length}`;
            document.getElementById("count-percent").innerHTML = "0%";

            if (hasPTag || hasOlTag || hasUlTag || hasTableTag) {
                if(hasTableTag){
                    let trChunks = text_element.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
                    let processedTrChunks = []
                    for (let tr of trChunks){
                        let response = await requestAPI(tr);
                        processedTrChunks.push(prettier.format(response, settings));
                        document.getElementById("count-percent").innerHTML = `${Math.round((processedTrChunks.length / trChunks.length) * 100)}%`;
                    }
                    let processedTableChunk = text_element.replace(/(<table[^>]*>)([\s\S]*?)(<\/table>)/, `$1${processedTrChunks.join('')}$3`);
                    processedChunks.push(processedTableChunk);
                } else if(hasOlTag){
                    let olChunks = text_element.match(/<ol[^>]*>[\s\S]*?<\/ol>/g) || [];
                    let liRegex = /<li[^>]*>[\s\S]*?<\/li>/g;
                    for (let olChunk of olChunks) {
                        let spanChunks = splitByRegex(olChunk, 20, liRegex);
                        let processedLiChunks = [];

                        for (let chunk of spanChunks) {
                            let response = await requestAPI(chunk);
                            processedLiChunks.push(prettier.format(response, settings));
                            document.getElementById("count-percent").innerHTML = `${Math.round((processedLiChunks.length / spanChunks.length) * 100)}%`;
                        }
                        // Ghép các đoạn được trả về và bổ sung thẻ <ol> ban đầu
                        let processedOlChunk = olChunk.replace(/(<ol[^>]*>)([\s\S]*?)(<\/ol>)/, `$1${processedLiChunks.join('')}$3`);
                        processedChunks.push(processedOlChunk);
                    }
                } else if (hasUlTag){
                    let ulChunks = text_element.match(/<ul[^>]*>[\s\S]*?<\/ul>/g) || [];
                    let liRegex = /<li[^>]*>[\s\S]*?<\/li>/g;
                    for (let ulChunk of ulChunks) {
                        let spanChunks = splitByRegex(ulChunk, 20, liRegex);
                        let processedLiChunks = [];

                        for (let chunk of spanChunks) {
                            let response = await requestAPI(chunk);
                            processedLiChunks.push(prettier.format(response, settings));
                            document.getElementById("count-percent").innerHTML = `${Math.round((processedLiChunks.length / spanChunks.length) * 100)}%`;
                        }
                        // Ghép các đoạn được trả về và bổ sung thẻ <ul> ban đầu
                        let processedUlChunk = ulChunk.replace(/(<ul[^>]*>)([\s\S]*?)(<\/ul>)/, `$1${processedLiChunks.join('')}$3`);
                        processedChunks.push(processedUlChunk);
                    }
                } else if(hasPTag) {
                    // Biểu thức chính quy để chia tách thẻ p
                    let pChunks = text_element.match(/<p[^>]*>[\s\S]*?<\/p>/g) || [];
                    let spanRegex = /<span[^>]*>([\s\S]*?)<\/span>/g;
                    for (let pChunk of pChunks) { // Xử lý từng đoạn văn
                        // Chia thành các đoạn nhỏ chứa tối đa 20 thẻ <span>
                        let spanChunks = splitByRegex(pChunk, 20, spanRegex);
                        let processedSpanChunks = []; // Mảng chứa các đoạn đã được xử lý
            
                        for (let chunk of spanChunks) { // Gửi từng đoạn đến requestAPI
                            let response = await requestAPI(chunk);
                            // Định dạng lại để hiển thị ra ô main
                            processedSpanChunks.push(prettier.format(response, settings));
                            document.getElementById("count-percent").innerHTML = `${Math.round((processedSpanChunks.length / spanChunks.length) * 100)}%`;
                        }
                        // Ghép các đoạn được trả về và bổ sung thẻ <p> ban đầu
                        let processedPChunk = pChunk.replace(/(<p[^>]*>)([\s\S]*?)(<\/p>)/, `$1${processedSpanChunks.join('')}$3`);
                        processedChunks.push(processedPChunk);
                    }
                }
            } else {
                // nếu Không có các thẻ thì chia thành các đoạn nhỏ chứa tối đa 20 thẻ <span>
                let spanRegex = /<span[^>]*>([\s\S]*?)<\/span>/g;
                let spanChunks = splitByRegex(text, 20, spanRegex);
                let processedSpanChunks = [];
        
                for (let chunk of spanChunks) {
                    let response = await requestAPI(chunk);
                    processedSpanChunks.push(prettier.format(response, settings));
                    document.getElementById("count-percent").innerHTML = `( ${Math.round((processedSpanChunks.length / spanChunks.length) * 100)}% )`;
                }
                // Ghép các đoạn được trả về
                processedChunks.push(processedSpanChunks.join(''));
            }

        }
        // Ghép các đoạn văn đã được xử lý lại với nhau
        return `${processedChunks.join('')}`;
    }

    function showTabContent(textID, tabID) {
        const removeActive = (tab) => {
            let tabs = document.getElementsByClassName(tab);
            for (let tab of tabs) {
                tab.classList.remove('active');
            }
        }
        const addActive = (tabID) => {
            document.getElementById(tabID).classList.add('active');
        }
        if(tabID === "tab-text" || tabID === "tab-html"){
            removeActive('tab-content');
            removeActive('tab')
        } else if (tabID === "tab-res-text" || tabID === "tab-res-html"){
            removeActive('tab-res-content');
            removeActive('tab-res')
        }
        addActive(tabID);
        addActive(textID);
    }

    function splitHtml(html) {
        html = html.replace(/<\/?(html|body)[^>]*>/gi, '');

        let parser = new DOMParser();
        let doc = parser.parseFromString(html, "text/html");

        let elements = doc.body.children;
        let parts = [];

        for (let el of elements){
            parts.push(el.outerHTML);
        }

        return parts;
    }

    function getHtml(html) {
        // Thay thế các dấu xuống dòng giữa các thẻ HTML bằng khoảng trắng
        html = html.replace(/>\s+</g, '> <');
        let temporaryElement = document.createElement("div");
        temporaryElement.innerHTML = html;
        return temporaryElement.textContent || temporaryElement.innerText || "";
    }

    function splitByRegex(pTag, spanLimit, regex) {
        // Biểu thức chính quy để tìm và tách các thẻ <span>
        let matches = pTag.match(regex) || []; // Trả về mảng chứa các đoạn văn của thẻ span
        let chunks = []; // Mảng chứa các đoạn văn đã được chia nhỏ
    
        // Chia thành các đoạn nhỏ chứa tối đa 20 thẻ span
        for (let i = 0; i < matches.length; i += spanLimit) {
            let chunk = matches.slice(i, i + spanLimit).join('');
            chunks.push(chunk);
        }
        return chunks;
    }

    function processText(sTxt){
        if (sTxt[sTxt.length - 1] === '\n')
            sTxt = sTxt.slice(0, sTxt.length - 1);
    
        let splittedParas = sTxt.split('\n');
    
        document.getElementById("textarea").innerText = sTxt;

        return splittedParas;
    };

	function ExecPlugin() {
	    processText(txt);
	};

    async function requestAPI(content) {
        const API_key = '';
        const url = 'https://api.openai.com/v1/chat/completions';
        const headers = {
            'Authorization': `Bearer ${API_key}`,
            'Content-Type': 'application/json'
        };
        
        let choice = document.getElementById("choice").value;
        let request = ""
        if(choice === "SUA_LOI"){
            request = `Trong nội dung HTML sau đây, hãy kiểm tra lỗi chính tả các nội dung text và cho các từ bị sai chính tả vào trong thẻ <span style="background-color: yellow">, lưu ý tuyệt đối không thay đổi nội dung và định dạng của văn bản. Nếu không sai chính tả thì trả về đoạn html ban đầu.`
        } else if(choice === "NGU_PHAP"){
            request = `Trong nội dung HTML sau đây, hãy kiểm tra lỗi ngữ pháp các nội dung text và cho các từ bị sai ngữ pháp vào trong thẻ <span style="background-color: yellow">, lưu ý tuyệt đối không thay đổi nội dung và định dạng của văn bản. Nếu không sai ngữ pháp thì trả về đoạn html ban đầu.`
        }
        
        const data = {
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: request
                },
                { role: "user", content: content }
            ],
        };
    
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(data)
            });
    
            if (response.ok) {
                const jsonResponse = await response.json();
                return jsonResponse.choices[0].message.content;
            } else {
                console.error(`API request failed ${response.status}: ${response.statusText}`);
                return content;
            }
        } catch (error) {
            console.error('Error:', error);
            return content;
        }
    }
})(window, undefined);
