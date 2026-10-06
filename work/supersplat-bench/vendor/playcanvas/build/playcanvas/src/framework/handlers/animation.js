import { path } from '../../core/path.js';
import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Http, http } from '../../platform/net/http.js';
import { Animation, Node, Key } from '../../scene/animation/animation.js';
import { AnimEvents } from '../anim/evaluator/anim-events.js';
import { GlbParser } from '../parsers/glb-parser.js';
import { ResourceHandler } from './handler.js';

class AnimationHandler extends ResourceHandler {
		load(url, callback, asset) {
				if (typeof url === 'string') {
						url = {
								load: url,
								original: url
						};
				}
				var options = {
						retry: this.maxRetries > 0,
						maxRetries: this.maxRetries
				};
				if (url.load.startsWith('blob:') || url.load.startsWith('data:')) {
						if (path.getExtension(url.original).toLowerCase() === '.glb') {
								options.responseType = Http.ResponseType.ARRAY_BUFFER;
						} else {
								options.responseType = Http.ResponseType.JSON;
						}
				}
				http.get(url.load, options, (err, response)=>{
						if (err) {
								callback("Error loading animation resource: " + url.original + " [" + err + "]");
						} else {
								if (path.getExtension(url.original).toLowerCase() === '.glb') {
										var _asset_options;
										GlbParser.parse('filename.glb', '', response, this.device, this.assets, (_asset_options = asset == null ? undefined : asset.options) != null ? _asset_options : {}, (err, parseResult)=>{
												if (err) {
														callback(err);
												} else {
														var _asset_data;
														var animations = parseResult.animations;
														if (asset == null ? undefined : (_asset_data = asset.data) == null ? undefined : _asset_data.events) {
																for(var i = 0; i < animations.length; i++){
																		animations[i].events = new AnimEvents(Object.values(asset.data.events));
																}
														}
														parseResult.destroy();
														callback(null, animations);
												}
										});
								} else {
										callback(null, this["_parseAnimationV" + response.animation.version](response));
								}
						}
				});
		}
		open(url, data, asset) {
				return data;
		}
		_parseAnimationV3(data) {
				var animData = data.animation;
				var anim = new Animation();
				anim.name = animData.name;
				anim.duration = animData.duration;
				for(var i = 0; i < animData.nodes.length; i++){
						var node = new Node();
						var n = animData.nodes[i];
						node._name = n.name;
						for(var j = 0; j < n.keys.length; j++){
								var k = n.keys[j];
								var t = k.time;
								var p = k.pos;
								var r = k.rot;
								var s = k.scale;
								var pos = new Vec3(p[0], p[1], p[2]);
								var rot = new Quat().setFromEulerAngles(r[0], r[1], r[2]);
								var scl = new Vec3(s[0], s[1], s[2]);
								var key = new Key(t, pos, rot, scl);
								node._keys.push(key);
						}
						anim.addNode(node);
				}
				return anim;
		}
		_parseAnimationV4(data) {
				var animData = data.animation;
				var anim = new Animation();
				anim.name = animData.name;
				anim.duration = animData.duration;
				for(var i = 0; i < animData.nodes.length; i++){
						var node = new Node();
						var n = animData.nodes[i];
						node._name = n.name;
						var defPos = n.defaults.p;
						var defRot = n.defaults.r;
						var defScl = n.defaults.s;
						for(var j = 0; j < n.keys.length; j++){
								var k = n.keys[j];
								var t = k.t;
								var p = defPos ? defPos : k.p;
								var r = defRot ? defRot : k.r;
								var s = defScl ? defScl : k.s;
								var pos = new Vec3(p[0], p[1], p[2]);
								var rot = new Quat().setFromEulerAngles(r[0], r[1], r[2]);
								var scl = new Vec3(s[0], s[1], s[2]);
								var key = new Key(t, pos, rot, scl);
								node._keys.push(key);
						}
						anim.addNode(node);
				}
				return anim;
		}
		constructor(app){
				super(app, 'animation');
				this.device = app.graphicsDevice;
				this.assets = app.assets;
		}
}

export { AnimationHandler };
