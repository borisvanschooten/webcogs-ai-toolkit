// XXX still relies on globals generated_tools, generated_functions, disabled_tools
async function callLLM(client,messages,tools,aifnPrefix,generated_functions,modelName="o3",nrTries=20,showToolCallsElem="response",truncateResult=2000) {
	var outputString = ""
	while (nrTries >= 0) {
		nrTries--
		var alltools = tools
		if (typeof generated_tools != "undefined") {
			alltools = tools.concat(generated_tools)
		}
		var enabledtools = alltools
		if (typeof disabled_tools != "undefined") {
			enabledtools = alltools.filter(
				(tool) => !Object.prototype.hasOwnProperty.call(disabled_tools, tool.function.name)
			);
		}
		//console.log(enabledtools)
		//console.log(messages)
		const completion = await client.chat.completions.create({
			model: modelName,
			tools: enabledtools,
			messages,
		});
		msg = completion.choices[0].message
		messages.push(msg)
		if (msg.content) {
			outputString += msg.content
		}
		if (typeof msg.tool_calls != "undefined") {
			for (let tool_call of msg.tool_calls) {
				let fn = tool_call.function.name;
				let args = JSON.parse(tool_call.function.arguments)
				let unpackedArgs = {};

				for (let [key, value] of Object.entries(args)) {
					try {
						unpackedArgs[key] = JSON.parse(value)
					} catch (e) {
						if (e instanceof SyntaxError || e instanceof TypeError) {
							unpackedArgs[key] = value;
						}
					}
				}
				// XXX suppress when in cli mode, should be an option
				if (showToolCallsElem) {
					console.log("Calling tool: " + fn, "args:" + JSON.stringify(unpackedArgs))
				}
				let funcCalled = false
				var errorMessage = null
				var result = null
				try {
					if (typeof window != "undefined" && window[aifnPrefix+fn]) {
						result = await window[aifnPrefix+fn](unpackedArgs)
						funcCalled = true;
					} else if (generated_functions[fn]) {
						result = await generated_functions[fn](unpackedArgs)
						funcCalled = true;
					} else {
						errorMessage = `Failure: Function ${fn} does not exist.`
					}
				} catch (error) {
					errorMessage = "Failure: An error occurred: " + error
				}
				if (errorMessage) {
					console.log(errorMessage)
				}
				if (funcCalled) {
					if (showToolCallsElem) {
						const responseElement = document.getElementById(showToolCallsElem)
						const toolDiv = document.createElement('div')
						toolDiv.className = "call_tool"
						var params = JSON.stringify(unpackedArgs)
						if (params.length > 100) {
							params = params.substring(0, 100)+" ...[truncated]"
						}
						toolDiv.innerText = `Tool ${fn} called with parameters ${params}`
						responseElement.appendChild(toolDiv)
					}
					if (!result) result = "Success"
					if (typeof result != "string") result = JSON.stringify(result)
					if (result.length > truncateResult) {
						result = result.substring(0, truncateResult) + "...(truncated)";
					}
					messages.push({
						"content": result,
						"role": "tool",
						"tool_call_id": tool_call.id
					})
				} else {
					messages.push({
						"content": errorMessage,
						"role": "tool",
						"tool_call_id": tool_call.id
					})
				}
			}
		} else {
			// no more tool calls ends turn
			return outputString;
		}
	}
	return outputString;
}

if (typeof module == "object") {
	module.exports = {callLLM}
}
