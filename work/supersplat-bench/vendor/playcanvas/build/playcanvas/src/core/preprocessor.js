var KEYWORD = /[ \t]*#(ifn?def|if|endif|else|elif|define|undef|extension|include)/g;
var DEFINE = /define[ \t]+([^\n]+)\r?(?:\n|$)/g;
var EXTENSION = /extension[ \t]+([\w-]+)[ \t]*:[ \t]*(enable|require)/g;
var UNDEF = /undef[ \t]+([^\n]+)\r?(?:\n|$)/g;
var IF = /(ifdef|ifndef|if)[ \t]*([^\r\n]+)\r?\n/g;
var ENDIF = /(endif|else|elif)([ \t][^\r\n]+)?\r?(?:\n|$)/g;
var IDENTIFIER = /([\w-]+)/;
var DEFINED = /(!|\s)?defined\(([\w-]+)\)/;
var COMPARISON = /([a-z_]\w*)\s*(==|!=|<|<=|>|>=)\s*([\w"']+)/i;
var INVALID = /[|&+-]/g;
var INCLUDE = /include[ \t]+"([\w-]+)"\r?(?:\n|$)/g;
class Preprocessor {
		static run(source, includes, options) {
				if (includes === undefined) includes = new Map();
				if (options === undefined) options = {};
				Preprocessor.sourceName = options.sourceName;
				source = this.stripComments(source);
				source = source.split(/\r?\n/).map((line)=>line.trimEnd()).join('\n');
				var defines = new Map();
				if (options.stripUnusedColorAttachments) {
						var counts = new Map();
						var regex = /(pcFragColor[1-8])\b/g;
						var matches = source.match(regex);
						matches == null ? undefined : matches.forEach((match)=>{
								var index = parseInt(match.charAt(match.length - 1), 10);
								var _counts_get;
								counts.set(index, ((_counts_get = counts.get(index)) != null ? _counts_get : 0) + 1);
						});
						counts.forEach((count, index)=>{
								if (count === 1) {
										defines.set("REMOVE_COLOR_ATTACHMENT_" + index, '');
								}
						});
				}
				source = this._preprocess(source, defines, includes, options.stripDefines);
				var intDefines = new Map();
				defines.forEach((value, key)=>{
						if (Number.isInteger(parseFloat(value)) && !value.includes('.')) {
								intDefines.set(key, value);
						}
				});
				var injectDefines = new Map();
				defines.forEach((value, key)=>{
						if (key.startsWith('__INJECT_')) {
								injectDefines.set(key, value);
						}
				});
				source = this.stripComments(source);
				source = this.RemoveEmptyLines(source);
				source = this.processArraySize(source, intDefines);
				source = this.injectDefines(source, injectDefines);
				return source;
		}
		static stripComments(source) {
				return source.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');
		}
		static processArraySize(source, intDefines) {
				if (source !== null) {
						intDefines.forEach((value, key)=>{
								source = source.replace(new RegExp("\\[" + key + "\\]", 'g'), "[" + value + "]");
						});
				}
				return source;
		}
		static injectDefines(source, injectDefines) {
				if (source !== null && injectDefines.size > 0) {
						var lines = source.split('\n');
						injectDefines.forEach((value, key)=>{
								var regex = new RegExp("\\b" + key + "\\b", 'g');
								for(var i = 0; i < lines.length; i++){
										if (!lines[i].includes('#')) {
												lines[i] = lines[i].replace(regex, value);
										}
								}
						});
						source = lines.join('\n');
				}
				return source;
		}
		static RemoveEmptyLines(source) {
				if (source !== null) {
						source = source.split(/\r?\n/).map((line)=>line.trim() === '' ? '' : line).join('\n');
						source = source.replace(/(\n\n){3,}/g, '\n\n');
				}
				return source;
		}
		static _preprocess(source, defines, includes, stripDefines) {
				if (defines === undefined) defines = new Map();
				var originalSource = source;
				var stack = [];
				var error = false;
				var match;
				while((match = KEYWORD.exec(source)) !== null){
						var keyword = match[1];
						switch(keyword){
								case 'define':
										{
												DEFINE.lastIndex = match.index;
												var define = DEFINE.exec(source);
												error || (error = define === null);
												var expression = define[1];
												IDENTIFIER.lastIndex = define.index;
												var identifierValue = IDENTIFIER.exec(expression);
												var identifier = identifierValue[1];
												var value = expression.substring(identifier.length).trim();
												if (value === '') value = 'true';
												var keep = Preprocessor._keep(stack);
												if (keep) {
														defines.set(identifier, value);
														if (stripDefines) {
																source = source.substring(0, define.index - 1) + source.substring(DEFINE.lastIndex);
																KEYWORD.lastIndex = define.index - 1;
														}
												}
												if (!stripDefines) {
														KEYWORD.lastIndex = define.index + define[0].length;
												}
												break;
										}
								case 'undef':
										{
												UNDEF.lastIndex = match.index;
												var undef = UNDEF.exec(source);
												var identifier1 = undef[1].trim();
												var keep1 = Preprocessor._keep(stack);
												if (keep1) {
														defines.delete(identifier1);
														if (stripDefines) {
																source = source.substring(0, undef.index - 1) + source.substring(UNDEF.lastIndex);
																KEYWORD.lastIndex = undef.index - 1;
														}
												}
												if (!stripDefines) {
														KEYWORD.lastIndex = undef.index + undef[0].length;
												}
												break;
										}
								case 'extension':
										{
												EXTENSION.lastIndex = match.index;
												var extension = EXTENSION.exec(source);
												error || (error = extension === null);
												if (extension) {
														var identifier2 = extension[1];
														var keep2 = Preprocessor._keep(stack);
														if (keep2) {
																defines.set(identifier2, 'true');
														}
												}
												KEYWORD.lastIndex = extension.index + extension[0].length;
												break;
										}
								case 'ifdef':
								case 'ifndef':
								case 'if':
										{
												IF.lastIndex = match.index;
												var iff = IF.exec(source);
												var expression1 = iff[2];
												var evaluated = Preprocessor.evaluate(expression1, defines);
												error || (error = evaluated.error);
												var result = evaluated.result;
												if (keyword === 'ifndef') {
														result = !result;
												}
												stack.push({
														anyKeep: result,
														keep: result,
														start: match.index,
														end: IF.lastIndex
												});
												KEYWORD.lastIndex = iff.index + iff[0].length;
												break;
										}
								case 'endif':
								case 'else':
								case 'elif':
										{
												ENDIF.lastIndex = match.index;
												var endif = ENDIF.exec(source);
												var blockInfo = stack.pop();
												var blockCode = blockInfo.keep ? source.substring(blockInfo.end, match.index) : '';
												source = source.substring(0, blockInfo.start) + blockCode + source.substring(ENDIF.lastIndex);
												KEYWORD.lastIndex = blockInfo.start + blockCode.length;
												var endifCommand = endif[1];
												if (endifCommand === 'else' || endifCommand === 'elif') {
														var result1 = false;
														if (!blockInfo.anyKeep) {
																if (endifCommand === 'else') {
																		result1 = !blockInfo.keep;
																} else {
																		var evaluated1 = Preprocessor.evaluate(endif[2], defines);
																		result1 = evaluated1.result;
																		error || (error = evaluated1.error);
																}
														}
														stack.push({
																anyKeep: blockInfo.anyKeep || result1,
																keep: result1,
																start: KEYWORD.lastIndex,
																end: KEYWORD.lastIndex
														});
												}
												break;
										}
								case 'include':
										{
												INCLUDE.lastIndex = match.index;
												var include = INCLUDE.exec(source);
												error || (error = include === null);
												var identifier3 = include[1].trim();
												var keep3 = Preprocessor._keep(stack);
												if (keep3) {
														var includeSource = includes == null ? undefined : includes.get(identifier3);
														if (includeSource !== undefined) {
																source = source.substring(0, include.index - 1) + includeSource + source.substring(INCLUDE.lastIndex);
																KEYWORD.lastIndex = include.index - 1;
														} else {
																console.error('Include "' + identifier3 + '" not resolved while preprocessing ' + Preprocessor.sourceName, {
																		source: originalSource
																});
																error = true;
														}
												}
												break;
										}
						}
				}
				if (error) {
						console.warn('Failed to preprocess shader: ', {
								source: originalSource
						});
						return originalSource;
				}
				return source;
		}
		static _keep(stack) {
				for(var i = 0; i < stack.length; i++){
						if (!stack[i].keep) {
								return false;
						}
				}
				return true;
		}
		static evaluate(expression, defines) {
				var correct = INVALID.exec(expression) === null;
				var invert = false;
				var defined = DEFINED.exec(expression);
				if (defined) {
						invert = defined[1] === '!';
						expression = defined[2];
				}
				var comparison = COMPARISON.exec(expression);
				if (comparison) {
						var _defines_get;
						var left = (_defines_get = defines.get(comparison[1])) != null ? _defines_get : comparison[1];
						var _defines_get1;
						var right = (_defines_get1 = defines.get(comparison[3])) != null ? _defines_get1 : comparison[3];
						var operator = comparison[2];
						var result = false;
						switch(operator){
								case '==':
										result = left === right;
										break;
								case '!=':
										result = left !== right;
										break;
								case '<':
										result = left < right;
										break;
								case '<=':
										result = left <= right;
										break;
								case '>':
										result = left > right;
										break;
								case '>=':
										result = left >= right;
										break;
						}
						return {
								result,
								error: !correct
						};
				}
				expression = expression.trim();
				var exists = defines.has(expression);
				if (invert) {
						exists = !exists;
				}
				return {
						result: exists,
						error: !correct
				};
		}
}

export { Preprocessor };
