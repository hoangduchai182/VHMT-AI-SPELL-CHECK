let savedDismiss = [];
(function(window, undefined){
	let txt = "";
	window.Asc.plugin.init = function(text)	{
		txt = replaceDangerousText(text);
		savedDismiss = [];
		switch (window.Asc.plugin.info.editorType) {
            case 'word':
            case 'slide': {
                window.Asc.plugin.executeMethod("GetSelectedText", [{Numbering:false, Math: false, TableCellSeparator: '\n', ParaSeparator: '\n', TabSymbol: String.fromCharCode(160)}], function(data) {
                    txt = replaceDangerousText((data === undefined) ? "" : data.replace(/\r/g, ' '));
                    ExecPlugin();
                });
                break;
            }
            case 'cell':
                window.Asc.plugin.executeMethod("GetSelectedText", [{Numbering:false, Math: false, TableCellSeparator: '\n', ParaSeparator: '\n', TabSymbol: String.fromCharCode(160)}], function(data) {
                    if (data == '')
                        txt = replaceDangerousText(txt.replace(/\r/g, ' ').replace(/\t/g, '\n'));
                    else if (data !== undefined) {
                        txt = replaceDangerousText(data.replace(/\r/g, ' '));
                    }
                    ExecPlugin();
                });
                break;
        }

        let response = "";
        document.getElementById("check-gpt").onclick = async function() {
            // xóa dấu cách cuối dòng nếu có
            txt = txt.split('\n').map(paragraph => {
                if(paragraph[paragraph.length - 1] == " "){
                    paragraph = paragraph.slice(0, paragraph.length - 1);
                }
                return paragraph;
            }).join('\n');

            let paragraphs = txt.split('\n');
            let list_response = [];

            document.getElementById("count-percent").innerHTML = "0%";
            document.getElementById("processing-message").style.display = "block";

            for (let paragraph of paragraphs) {
                document.getElementById("count-part").innerText = `${paragraphs.indexOf(paragraph) + 1}/${paragraphs.length}`;
                if (paragraph != ""){
                    // nếu đoạn văn dài hơn 2000 ký tự 
                    if (paragraph.length > 2000) {
                        let long_paragraph = [];
                        let splitPara = splitText(paragraph);
                        for (let para of splitPara) {
                            let res = await requestAPI(para);
                            long_paragraph.push(res);
                        }
                        list_response.push(long_paragraph.join(''));
                    } else {
                        let res = await requestAPI(paragraph);
                        list_response.push(res);
                    }
                }
            }

            document.getElementById("processing-message").style.display = "none";

            response = list_response.join('\n');
            document.getElementById("result").innerText = response;
            console.log(txt);
            console.log(response);

            let list_error = compareText(txt, response);
            console.log(list_error);
            let highlight_text = "";
            let current_position = 0;
            let html_error = "";
            for (error of list_error) {
                let error_text = error.old === "" ? txt.slice(error.start - 1, error.end) : txt.slice(error.start, error.end);
                let error_html = `<span id="${error.id}" style="background-color: #f62211">${error_text}</span>`;
                let new_txt = txt.slice(current_position, error.start).replace(/\n/g, '<br>') + error_html;
                highlight_text += new_txt;
                current_position = error.end;

                let start_text = error.start < 30 ? `${txt.slice(0, error.start)}` : `...${txt.slice(error.start - 30, error.start)}`;
                let end_text = error.end + 30 > txt.length ? `${txt.slice(error.end, txt.length)}` : `${txt.slice(error.end, error.end + 30)}...`;

                let change_text = "";
                if(error.old === ""){
                    change_text = "Thêm vào";
                } else if (error.new === ""){
                    change_text = "Xóa bỏ";
                } else {
                    change_text = "Thay thế";
                }

                let html = `
                    <div class="error mb-1" id="${error.id}_div">
                        <div class="flex justify-center">
                            <div>${start_text} <span style="background-color: #ffff00">${error_text}</span> ${end_text}</div>
                        </div>
                        <hr>
                        <div>
                            <div id="new" class="flex justify-center mb-1">
                                <button class="error_text border-green">${error.new}</button>
                            </div>
                            <div id="dismiss" class="flex flex-around">
                                <button class="error_text border-gray" id="${error.id}_skip">Bỏ qua</button>
                                <button class="error_text border-gray" id="${error.id}_move">Đi tới</button>
                                <button class="error_text border-gray" id="${error.id}_change">${change_text}</button>
                            </div>
                        </div>
                    </div>
                `;
                html_error += html;
            }
            highlight_text += txt.slice(current_position, txt.length).replace(/\n/g, '<br>');
            document.getElementById("textarea").innerHTML = highlight_text;
            document.getElementById("result-part").innerHTML = html_error;
            document.getElementById("error_list").style.display = "block";

            list_error.forEach(error => {
                document.getElementById(`${error.id}_change`).onclick = function() {
                    document.getElementById(error.id).innerText = error.new;
                    document.getElementById(error.id).style.backgroundColor = "white";
                    document.getElementById(`${error.id}_div`).style.display = "none";
                }
                document.getElementById(`${error.id}_skip`).onclick = function() {
                    document.getElementById(error.id).style.backgroundColor = "white";
                    document.getElementById(`${error.id}_div`).style.display = "none";
                }
                document.getElementById(`${error.id}_move`).onclick = function() {
                    document.getElementById(`${error.id}`).scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
        };
        document.getElementById("btn_paste").onclick = function() {
            Asc.scope.arr = document.getElementById("textarea").innerText.split(/\n/);
            if (Asc.scope.arr.length === 0)
                document.getElementById("warning-message").style.display = "block";
            else {
                window.Asc.plugin.info.recalculate = true;

                // for usual paste
                var strResult = "";
                for (var Item = 0; Item < Asc.scope.arr.length; Item++) {
                    if (Asc.scope.arr[Item] === "")
                        continue;
                    if (Item < Asc.scope.arr.length - 1)
                        strResult += Asc.scope.arr[Item] + '\n';
                    else
                        strResult += Asc.scope.arr[Item];
                }
    
                if (strResult === "")
                    return;
    
                window.Asc.plugin.executeMethod("GetVersion", [], function(version) {
                    if (version === undefined) {
                       window.Asc.plugin.executeMethod("PasteText", [strResult], function(result) {
                            paste_done = true;
                       });
                    }
                    else {
                        window.Asc.plugin.executeMethod("GetSelectionType", [], function(sType) {
                            switch (sType) {
                                case "none":
                                case "drawing":
                                    window.Asc.plugin.executeMethod("PasteText", [strResult], function(result) {
                                        paste_done = true;
                                    });
                                    break;
                                case "text":
                                    window.Asc.plugin.callCommand(function() {
                                        Api.ReplaceTextSmart(Asc.scope.arr, String.fromCharCode(160));
                                    }, undefined, undefined, function(result) {
                                        paste_done = true;
                                    });
                                    break;
                            }
                        });
                    }
                });
            }
        };
        document.getElementById("tab-old").onclick = function() {
            showTabContent('textarea', "tab-old");
        };
        document.getElementById("tab-new").onclick = function() {
            showTabContent('result', "tab-new");
        };
        document.getElementById("warning-message").onclick = function() {
            document.getElementById("warning-message").style.display = "none";
        }
        document.getElementById("clear").onclick= function() {
            document.getElementById("textarea").innerText = "";
            document.getElementById("result").innerText = "";
            response = "";
            txt = "";
            document.getElementById("result-part").innerHTML = "";
            document.getElementById("error_list").style.display = "none";
        };
	};

    // Tách đoạn văn dài trên 2000 ký tự thành các đoạn văn ngắn hơn
    function splitText(text) {
        let result = [];
        let currentChunk = "";
        let sentences = text.split('.');
    
        for (let sentence of sentences) {
            if ((currentChunk + sentence).length > 2000) {
                result.push(currentChunk + '.');
                currentChunk = sentence.trim();
            } else {
                currentChunk += sentence + '.';
            }
        }
    
        if (currentChunk.length > 0) {
            result.push(currentChunk);
        }
    
        return result;
    };

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

	function replaceDangerousText(text) {
		return text.replace(/\x3C/g,'<').replace(/</g,'&lt').replace(/>/g,'&gt');
	};

    function compareText(text1, text2) {

        let list_error = [];
        let diff = Diff.diffWords(text1, text2);
    
        let position = 0;
        let lastRemoved = null;
    
        diff.forEach((part) => {
            if (!part.added && !part.removed) {
                position += part.value.length;
                if (lastRemoved) {
                    list_error.push({ old: lastRemoved.value, new: "", start: lastRemoved.start, end: lastRemoved.start + lastRemoved.value.length });
                    lastRemoved = null;
                }
            }
            if (part.added) {
                if (lastRemoved) {
                    list_error.push({ old: lastRemoved.value, new: part.value, start: lastRemoved.start, end: lastRemoved.start + lastRemoved.value.length });
                    lastRemoved = null;
                } else {
                    list_error.push({ old: "", new: part.value, start: position, end: position });
                }
            } else if (part.removed) {
                lastRemoved = { value: part.value, start: position };
                position += part.value.length;
            }
        });
    
        if (lastRemoved) {
            list_error.push({ old: lastRemoved.value, new: "", start: lastRemoved.start, end: lastRemoved.start + lastRemoved.value.length });
        }

        list_error.forEach((error, index) => {
            error.id = `error_${index + 1}`;
        });
    
        return list_error;
    };

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
        if(tabID === "tab-old" || tabID === "tab-new"){
            removeActive('tab-content');
            removeActive('tab')
        }
        addActive(tabID);
        addActive(textID);
    };

    async function requestAPI(content) {
        const headers = {
            'Authorization': `Bearer ${sk-proj-K6NPeCxlIP7UmiNUPZCpT3BlbkFJ71dhOcDVXR8MaKfA5qLm}`,
            'Content-Type': 'application/json'
        };
        
        // let choice = document.getElementById("choice").value;
        // let request = ""
        // if(choice === "SUA_LOI"){
        //     request = `Trong văn bản sau, hãy kiểm tra lỗi chính tả và sửa lại cho đúng. Nếu không có lỗi chính tả thì trả về văn bản ban đầu.`;
        // } else if(choice === "NGU_PHAP"){
        //     request = `Trong nội dung HTML sau đây, hãy kiểm tra lỗi ngữ pháp các nội dung text và cho các từ bị sai ngữ pháp vào trong thẻ <span style="background-color: yellow">, lưu ý tuyệt đối không thay đổi nội dung và định dạng của văn bản. Nếu không sai ngữ pháp thì trả về đoạn html ban đầu.`
        // }
        
        const data = {
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: `Trong văn bản sau, hãy kiểm tra lỗi chính tả và sửa lại cho đúng. Lưu ý giữ nguyên dấu cách dòng nếu xuất hiện trong văn bản. Nếu không có lỗi chính tả thì trả về văn bản ban đầu.`
                },
                { role: "user", content: content }
            ],
        };

        const url = 'https://api.openai.com/v1/chat/completions';
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
    };
})(window, undefined);