/*!
* mp-poster.js v1.0.0
* (c) 2021-2021 tutustack
* Released under the MIT License.
*/
(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.P = {}));
}(this, (function (exports) { 'use strict';

	const shared = {
	    resource: {},
	    find(name) {
	        return this.resource[name];
	    },
	    add(asset, baseImage) {
	        if (!this.resource[asset.name]) {
	            this.resource[asset.name] = baseImage;
	        }
	        if (!this.resource[asset.url]) {
	            this.resource[asset.url] = baseImage;
	        }
	    },
	    exist(asset) {
	        return !!(this.resource[asset.name] || this.resource[asset.url]);
	    }
	};

	const pixelRatio = 2;

	class Renderer {
		constructor (canvasId, opt = {width: 800, height: 400}, done) {

			this.width = opt.width * pixelRatio;
			this.height = opt.height * pixelRatio;


			const query = wx.createSelectorQuery();
			query.select(canvasId)
				.fields({ node: true, size: true })
				.exec((res) => {
					const canvas = res[0].node;
					const ctx = canvas.getContext('2d');

					const sysInfo = wx.getSystemInfoSync();
					shared.isDevtool = sysInfo.platform == 'devtools';
					const dpr = sysInfo.pixelRatio || 1;

					this.context = ctx;
					canvas.width = this.width;
					canvas.height = this.height;

					shared.canvas = canvas;
					shared.ctx = ctx;
					shared.dpr = dpr;

					typeof done === 'function' && done();
				});


			const ticks = [];
			this.tick = {
				add: (fn) => {
					if (typeof fn === 'function') {
						ticks.push(fn);
					}
				},
				emit: () => {
					const len = ticks.length;
					for (let i = 0; i < len; i++) {
						const tickCallFunc = ticks[i];
						tickCallFunc.call(this);
					}
				}
			};
		}

		run () {
			shared.canvas.requestAnimationFrame(() => {
				this.run();
				this.tick.emit();
			});
		}

		renderDisplayObject (displayObject) {
			displayObject.updateTransform();

			if (displayObject.renderable && displayObject.alpha > 0) {
				const transform = displayObject.worldTransform;
				this.context.setTransform(transform[0], transform[3], transform[1], transform[4], transform[2], transform[5]);
				this.context.globalAlpha = displayObject.worldAlpha;

				displayObject.render(this.context);
			}

			if (displayObject.children) {
				for (let i = 0; i < displayObject.children.length; i++) {
					const child = displayObject.children[i];
					this.renderDisplayObject(child);
				}
			}
		}

		render(stage) {
			this.context.setTransform(1, 0, 0, 1, 0, 0);
			this.context.globalCompositeOperation = 'source-over';
			this.context.clearRect(0, 0, this.width, this.height);

			stage.scale.set(pixelRatio, pixelRatio);
			this.renderDisplayObject(stage);
		}
	}

	class EventEmitter {
	    constructor() {
	        this.table = Object.create(null);
	    }
	    on(name, fn) {
	        const { table } = this;
	        if (!table[name]) {
	            table[name] = [];
	        }
	        table[name].push(fn);
	        return this;
	    }
	    once(name, fn) {
	        const self = this;
	        const { table } = this;
	        if (!table[name]) {
	            table[name] = [];
	        }
	        function onceFunc(...args) {
	            self.off(name, onceFunc);
	            fn.apply(this, args);
	        }
	        table[name].push(onceFunc);
	        return this;
	    }
	    off(name, fn) {
	        const { table } = this;
	        const targetQueue = table[name];
	        if (targetQueue) {
	            if (fn) {
	                const index = targetQueue.indexOf(fn);
	                if (~index) {
	                    return targetQueue.splice(index, 1).length > 0;
	                }
	            }
	            else {
	                targetQueue.length = 0;
	                return true;
	            }
	        }
	        return false;
	    }
	    clear() {
	        this.table = Object.create(null);
	    }
	    dispatchEvent(event, ...param) {
	        if (!event.type) {
	            return;
	        }
	        const { table } = this;
	        const targetQueue = table[event.type];
	        if (!targetQueue) {
	            return;
	        }
	        runFuncs(targetQueue);
	        function runFuncs(fns) {
	            const len = fns.length;
	            for (let i = 0; i < len; i++) {
	                const fn = fns[i];
	                fn.apply(event.context, param);
	            }
	        }
	    }
	}

	function def(target, prop, descriptor) {
	    descriptor.enumerable = descriptor.enumerable || false;
	    descriptor.configurable = true;
	    if ('value' in descriptor)
	        descriptor.writable = true;
	    Object.defineProperty(target, prop, descriptor);
	}
	function deepGet (object, path, defaultValue) {
		if (!path) {
		    return null;
		}

		return (!Array.isArray(path) ? path.replace(/\[/g, '.').replace(/\]/g, '').split('.') : path)
			.reduce((o, k) => (o || {})[k], object) || defaultValue
	}

	function type(obj) {
	    return Object.prototype.toString.call(obj).replace(/\[object\s|\]/g, '');
	}
	const isArray = (obj) => type(obj) == 'Array';
	const isObject = (obj) => type(obj) == 'Object';
	const isNumber = (obj) => type(obj) == 'Number';
	const isString = (obj) => type(obj) == 'String';
	let nextUid = 0;
	function uid() {
	    return ++nextUid;
	}



	class Loader extends EventEmitter {
		constructor(assetURLs) {
			super();
			this.loadCount = 0;
			this.assetURLs = this._processAssetURLs(assetURLs);
		}

		_processAssetURLs(assetURLs) {
			if (isArray(assetURLs)) {
				return assetURLs.map(assetURL => processItem(assetURL))
			} else if (isString(assetURLs)) {
				return [processItem(assetURLs )]
			}

			function processItem(assetURL) {
				if (isString(assetURL)) {
					return { name: assetURL, url: assetURL }
				} else if (isObject(assetURL)) {
					return assetURL
				}
			}
		}

		checkImage (fileurl) {
			const imageTypes = [
				'jpg',
				'jpeg',
				'png',
				'gif',
				'ico',
				'svg'
			];

			let fileType = fileurl.split('.').pop().toLowerCase();

			return imageTypes.indexOf(fileType) > -1
		}

		load () {
			const self = this;
			const len = this.loadCount = this.assetURLs.length;
			for (let i = 0; i < len; i++) {
				let assetItem = this.assetURLs[i];
				if (shared.exist(assetItem)) {
					self.onAssetLoaded();
				} else {
					let fileurl = assetItem.url;
					if (this.checkImage(fileurl)) {
						const img = shared.canvas.createImage();
						img.src = fileurl;
						img.onload = function () {
							shared.add(assetItem, img);
							self.onAssetLoaded();
						};

					}

				}

			}
		}

		onAssetLoaded () {
			this.loadCount--;
			this.dispatchEvent({ type: 'progress', context: this }, this.loadCount, this.assetURLs.length);

			if (this.loadCount === 0) {
				this.dispatchEvent({ type: 'loaded', context: this });
			}
		}
	}

	class Point {
	    constructor(x, y) {
	        this.x = x;
	        this.y = y;
	    }
	    set(x, y) {
	        this.x = x;
	        this.y = y;
	    }
	    clone() {
	        return new Point(this.x, this.y);
	    }
	}


	const Matrix = Float32Array;

	const mat3 = {
		create() {
			var matrix = new Matrix(9);

			matrix[0] = 1;
			matrix[1] = 0;
			matrix[2] = 0;
			matrix[3] = 0;
			matrix[4] = 1;
			matrix[5] = 0;
			matrix[6] = 0;
			matrix[7] = 0;
			matrix[8] = 1;

			return matrix
		},
		multiply(mat, mat2, dest) {
			if (!dest) { dest = mat; }

			var a00 = mat[0]; var a01 = mat[1]; var a02 = mat[2];
			var a10 = mat[3]; var a11 = mat[4]; var a12 = mat[5];
			var a20 = mat[6]; var a21 = mat[7]; var a22 = mat[8];

			var b00 = mat2[0]; var b01 = mat2[1]; var b02 = mat2[2];
			var b10 = mat2[3]; var b11 = mat2[4]; var b12 = mat2[5];
			var b20 = mat2[6]; var b21 = mat2[7]; var b22 = mat2[8];

			dest[0] = b00 * a00 + b01 * a10 + b02 * a20;
			dest[1] = b00 * a01 + b01 * a11 + b02 * a21;
			dest[2] = b00 * a02 + b01 * a12 + b02 * a22;

			dest[3] = b10 * a00 + b11 * a10 + b12 * a20;
			dest[4] = b10 * a01 + b11 * a11 + b12 * a21;
			dest[5] = b10 * a02 + b11 * a12 + b12 * a22;

			dest[6] = b20 * a00 + b21 * a10 + b22 * a20;
			dest[7] = b20 * a01 + b21 * a11 + b22 * a21;
			dest[8] = b20 * a02 + b21 * a12 + b22 * a22;

			return dest
		}
	};

	const PI_2 = Math.PI / 180;

	class DisplayObject {
		constructor () {
			this.rotation = 0;
			this.scale = new Point(1, 1);
			this.position = new Point(0, 0);
			this.skew = new Point(0, 0);
			this.alpha = 1;
			this.worldAlpha = 1;

			this.worldTransform = mat3.create();
			this.localTransform = mat3.create();
			this._sr = 0;
			this._cr = 1;

			this.rotationCach = 0;
			Object.keys(this.position).forEach(key => this._proxy(key, this.position));

			this.renderable = false;
		}

		_proxy (key, prop) {
			const self = this;
			const target = isObject(prop) ? prop : self;

			def(self, key, {
				get () {
					return target[key]
				},
				set (val) {
					if (target[key] === val) return

					target[key] = val;
				}
			});
		}

		get getGlobalPosition () {
			return {
				x: this.worldTransform[2],
				y: this.worldTransform[5],
			}
		}

		updateTransform () {
			let rotation, scaleX, scaleY;

			rotation = this.rotation * PI_2;
			scaleX = this.scale.x;
			scaleY = this.scale.y;

			if (this.skew.x || this.skew.y) {
				let skewX = PI_2 * this.skew.x;
				let skewY = PI_2 * this.skew.y;

				this.localTransform[0] = Math.cos(rotation + skewY) * scaleX;
				this.localTransform[3] = Math.sin(rotation + skewY) * scaleX;
				this.localTransform[1] = -Math.sin(rotation - skewX) * scaleY;
				this.localTransform[4] = Math.cos(rotation - skewX) * scaleY;
			} else {
				baseUpdate.call(this);
			}

			if (!this.parent) {
				this.worldAlpha = this.alpha;
				this.worldTransform = this.localTransform;
			} else {
				this.worldTransform = mat3.multiply(this.localTransform, this.parent.worldTransform, this.worldTransform);
				this.worldAlpha = this.alpha * this.parent.worldAlpha;
			}
		}
	}

	function baseUpdate() {
		let rotation = this.rotation * PI_2;

		if (this.rotation !== this.rotationCach) {
			this.rotationCach = this.rotation;
			this._sr = Math.sin(rotation);
			this._cr = Math.cos(rotation);
		}

		this.localTransform[0] = this._cr * this.scale.x;
		this.localTransform[1] = -this._sr * this.scale.y;
		this.localTransform[3] = this._sr * this.scale.x;
		this.localTransform[4] = this._cr * this.scale.y;

		this.localTransform[2] = this.position.x;
		this.localTransform[5] = this.position.y;
	}

	function remove(arr, ...items) {
	    items.forEach(item => {
	        let idx = arr.indexOf(item);
	        if (idx > -1) {
	            arr.splice(idx, 1);
	        }
	    });
	}
	function maxArr(arr) {
	    let len = arr.length;
	    let maxNum = arr[0];
	    for (let i = 1; i < len; i++) {
	        let current = arr[i];
	        if (maxNum < current) {
	            maxNum = current;
	        }
	    }
	    return maxNum;
	}
	function minArr(arr) {
	    let len = arr.length;
	    let minNum = arr[0];
	    for (let i = 1; i < len; i++) {
	        let current = arr[i];
	        if (minNum > current) {
	            minNum = current;
	        }
	    }
	    return minNum;
	}

	function resetShadow (ctx) {
		ctx.shadowColor = 'rgba(0, 0, 0, 0)';
		ctx.shadowBlur = 0;
		ctx.shadowOffsetY = 0;
		ctx.shadowOffsetX = 0;
	}

	class Rect extends DisplayObject {
		constructor (width = 80, height) {
			super();

			if (isNumber(height)) {
				this.height = height;
				this.width = width;
			} else {
				this.height = this.width = width;
			}

			this._r = 0;
			this.anchor = new Point(0, 0);
			this.renderable = true;
			this.color = this.borderColor = '#000';
			this.borderWidth = 0;

			this.shadowColor = 'rgba(0, 0, 0, 0)';
			this.shadowBlur = 0;
			this.shadowOffsetY = 0;
			this.shadowOffsetX = 0;
			this.shadowIsInset = false;

			this.borderTopLeftRadius = 0;
			this.borderTopRightRadius = 0;
			this.borderBottomLeftRadius = 0;
			this.borderBottomRightRadius = 0;
		}

		get mask () {
			return this.maskDisplayObject
		}
		set mask (maskVal) {
			if (!(this.maskDisplayObject === maskVal)) {
				if (maskVal instanceof DisplayObject) {
					maskVal._ismask = true;
					maskVal._maskbind = this;
				} else {
					if (this.maskDisplayObject instanceof DisplayObject)
						this.maskDisplayObject._ismask = false;
						delete this.maskDisplayObject._maskbind;
				}

				this.maskDisplayObject = maskVal;
			}
		}

		_drawRect(ctx, x, y) {
			ctx.moveTo(x, y);
			ctx.lineTo(x, y + this.height);
			ctx.lineTo(x + this.width, y + this.height);
			ctx.lineTo(x + this.width, y);
			ctx.closePath();
		 }

		_drawRoundRect (ctx, x, y) {
			const {
				borderTopLeftRadius,
				borderTopRightRadius,
				borderBottomLeftRadius,
				borderBottomRightRadius
			} = this;

			this.getReasonRadius();
			const rw = this.width;
			const rh = this.height;

			const specialRaund = () => {

				if (borderTopLeftRadius) {
					if (borderTopLeftRadius > 0) {
						ctx.arc(
							x + borderTopLeftRadius, y + borderTopLeftRadius,
							borderTopLeftRadius,
							PI_2 * 180, PI_2 * 270,
							false
							);
					} else {
						ctx.arc(
							x, y,
							Math.abs(borderTopLeftRadius),
							PI_2 * 90, PI_2 * 0,
							true
							);
					}

				} else {
					ctx.moveTo(x, y);
				}

				if (borderTopRightRadius) {
					if (borderTopRightRadius > 0) {
						ctx.arc(
							x + rw - borderTopRightRadius , y + borderTopRightRadius,
							borderTopRightRadius,
							PI_2 * 270, PI_2 * 360,
							false
							);
					} else {
						ctx.arc(
							x + rw , y,
							Math.abs(borderTopRightRadius),
							PI_2 * 180, PI_2 * 90,
							true
							);
					}
					ctx.lineTo(x + rw, y + rh - Math.abs(borderBottomRightRadius));
				} else {
					ctx.lineTo(x + rw, y);
				}

				if (borderBottomRightRadius) {
					if (borderBottomRightRadius > 0) {
						ctx.arc(
							x + rw - borderBottomRightRadius, y + rh - borderBottomRightRadius,
							borderBottomRightRadius,
							PI_2 * 0, PI_2 * 90,
							false
							);
					} else {
						ctx.arc(
							x + rw, y + rh,
							Math.abs(borderBottomRightRadius),
							PI_2 * 270, PI_2 * 180,
							true
							);
					}
					ctx.lineTo(x + Math.abs(borderBottomLeftRadius), y + rh);

				} else {
					ctx.lineTo(x + rw, y + rh);
				}

				if (borderBottomLeftRadius) {
					if (borderBottomLeftRadius > 0) {
						ctx.arc(
							x + borderBottomLeftRadius, y + rh - borderBottomLeftRadius,
							borderBottomLeftRadius,
							PI_2 * 90, PI_2 * 180,
							false
							);
					} else {
						ctx.arc(
							x, y + rh,
							Math.abs(borderBottomLeftRadius),
							PI_2 * 0, PI_2 * -90,
							true
							);
					}
					ctx.lineTo(x, y + Math.abs(borderTopLeftRadius));
				} else {
					ctx.lineTo(x, y + rh);
				}
			};

			specialRaund();
		}

		_stroke (ctx) {
			const x = -this.anchor.x * this.width;
			const y = -this.anchor.y * this.height;

			if (this.borderWidth > 0) {

				ctx.lineWidth = this.borderWidth * 2;
				ctx.strokeStyle = this.borderColor;
				ctx.save();
				this._drawRoundRect(ctx, x, y);
				ctx.clip();

				ctx.stroke();
				ctx.restore();
			}
		}

		_fill (ctx) {
			const x = -this.anchor.x * this.width;
			const y = -this.anchor.y * this.height;

			this._drawRoundRect(ctx, x, y);
		}

		get borderRadius () {
			return this._r
		}
		set borderRadius (r) {
			if (this._r ===  r) return

			this._r = r;
			if (isNumber(this._r)) {
				this.borderTopLeftRadius = this._r;
				this.borderTopRightRadius = this._r;
				this.borderBottomLeftRadius = this._r;
				this.borderBottomRightRadius = this._r;
			}
		}

		getReasonRadius () {
			const maxRadius = minArr([this.width, this.height]) / 2;

			function processItem (prop) {
				this[prop] = Math.abs(this[prop]) > maxRadius ?
					this[prop]  < 0 ? -maxRadius : maxRadius
					: this[prop];
			}

			processItem.call(this, 'borderTopLeftRadius');
			processItem.call(this, 'borderTopRightRadius');
			processItem.call(this, 'borderBottomLeftRadius');
			processItem.call(this, 'borderBottomRightRadius');
		}

		_insetShadow (ctx) {
			const x = -this.anchor.x * this.width;
			const y = -this.anchor.y * this.height;

			ctx.beginPath();

			const s = 200;
			const outX = x - s;
			const outY = y - s;
			const width = this.width + s * 2;
			const height = this.height + s * 2;

			ctx.moveTo(outX, outY);
			ctx.lineTo(outX, outY + height);
			ctx.lineTo(outX + width, outY + height);
			ctx.lineTo(outX + width, outY);
			ctx.closePath(); //自动闭合

			this._drawRoundRect(ctx, x, y);

			ctx.fillStyle = this.shadowColor;
			ctx.closePath(); //自动闭合
		}

		get shadow () {
			return `${this.shadowOffsetX} ${this.shadowOffsetY} ${this.shadowBlur} ${this.shadowColor}${this.shadowIsInset && ' inset'}`
		}

		set shadow (val) {
			if (val === this.boxShadow) return

			let shadows;
			let shadowColor = this.shadowColor;
			if (val.indexOf('rgb') > -1) {
				const reg = /rgba?\(([^()]*)\)/;
				const res = val.match(reg);
				if (res) {
					shadowColor = res[0];
					shadows = val.split(shadowColor).map(item => item.trim().split(/\s+/)).reduce((f, s) => { return f.concat(s) }, []);
				}
			} else {
				shadows = val.trim().split(/\s+/).map(item => item.trim());
				shadowColor = shadows.splice(3, 1)[0];
			}

			this.shadowOffsetX = +shadows[0].replace('px', '');
			this.shadowOffsetY = +shadows[1].replace('px', '');
			this.shadowBlur = +shadows[2].replace('px', '');
			this.shadowColor = shadowColor;
			this.shadowIsInset = shadows[3] === 'inset';
		}

		popMask (ctx) {
			ctx.clip();

			const transform = this._maskbind.worldTransform;
			ctx.setTransform(transform[0], transform[3], transform[1], transform[4], transform[2], transform[5]);
			ctx.globalAlpha = this._maskbind.worldAlpha;

			this._maskbind.render(ctx, true);

			ctx.restore();
		}

		_draw (ctx) {
			if (this.shadowIsInset) {
				ctx.beginPath();
				this._fill(ctx);
				ctx.fill();
				ctx.save();

				ctx.clip();

				ctx.shadowColor = this.shadowColor;
				ctx.shadowBlur = this.shadowBlur;
				ctx.shadowOffsetY = this.shadowOffsetY;
				ctx.shadowOffsetX = this.shadowOffsetX;

				this._insetShadow(ctx);
				ctx.fill();
				ctx.restore();
			} else {
				ctx.shadowColor = this.shadowColor;
				ctx.shadowBlur = this.shadowBlur;
				ctx.shadowOffsetY = this.shadowOffsetY;
				ctx.shadowOffsetX = this.shadowOffsetX;

				ctx.beginPath();
				this._fill(ctx);
				ctx.fill();
			}

			this._stroke(ctx);
		}

		_fillStyle (ctx) {
			if (typeof this.linearGradient === 'function') {
				const res = this.linearGradient();
				const linearRect = res[0];
				const grad = ctx.createLinearGradient(
					linearRect[0],
					linearRect[1],
					linearRect[2],
					linearRect[3]
				);
				const stops = res[1];

				const len = stops.length;
				for (let i = 0; i < len; i++) {
					const currentStop = stops[i];
					grad.addColorStop(
						currentStop.stop,
						currentStop.color
					);
				}

				ctx.fillStyle = grad;
			} else {
				ctx.fillStyle = this.color;
			}
		}

		render(ctx, force = false) {
			if (this.maskDisplayObject && !force) return

			if (this._ismask) {
				ctx.save();
				this._fillStyle(ctx);
				ctx.beginPath();
				this._fill(ctx);
				this.popMask(ctx);
			} else {
				this._fillStyle(ctx);
				this._draw(ctx);
			}

			resetShadow(ctx);

		}

	}

	function convertStringToArrayBySpace (str, symbol) {
		let tempStr = str;
		let index;
		let pool = [];
		while ((index = tempStr.indexOf(symbol)) > -1) {
	        if (index > 0) {
	        	let str = tempStr.substring(0, index);
	            pool.push(...convertStringToArrayBySpace(str, '-'));
	        }

	        let str2 = tempStr.substring(index, index + 1);
			pool.push(...convertStringToArrayBySpace(str2));
			tempStr = tempStr.substr(index + 1 );
		}

	    if (!(tempStr === '')) {
	        pool.push(tempStr);
	    }

		return pool
	}

	function customMeasureText (text, fontSize = 10) {
		text = String(text);
		var text = text.split('');
		var width = 0;
		text.forEach(function(item) {
			if (/[a-zA-Z]/.test(item)) {
				width += 7;
			} else if (/[0-9]/.test(item)) {
				width += 5.5;
			} else if (/\./.test(item)) {
				width += 2.7;
			} else if (/-/.test(item)) {
				width += 3.25;
			} else if (/[\u4e00-\u9fa5]/.test(item)) {  //中文匹配
				width += 10;
			} else if (/\(|\)/.test(item)) {
				width += 3.73;
			} else if (/\s/.test(item)) {
				width += 2.5;
			} else if (/%/.test(item)) {
				width += 8;
			} else {
				width += 10;
			}
		});

		return {
			width: width * fontSize / 10,
			height: fontSize,
			actualBoundingBoxAscent: fontSize - 4
		}
	}

	function measureText (text, fontSize = 10) {
		if (shared.isDevtool) {
			const m = shared.ctx.measureText(text);
			const res = {
				actualBoundingBoxAscent: m.actualBoundingBoxAscent,
				actualBoundingBoxDescent: m.actualBoundingBoxDescent,
				actualBoundingBoxLeft: m.actualBoundingBoxLeft,
				actualBoundingBoxRight: m.actualBoundingBoxRight,
				advances: m.advances,
				emHeightAscent: m.emHeightAscent,
				emHeightDescent: m.emHeightDescent,
				fontBoundingBoxAscent: m.fontBoundingBoxAscent,
				fontBoundingBoxDescent: m.fontBoundingBoxDescent,
				width: m.width,
				height: Math.abs(m.actualBoundingBoxAscent) + Math.abs(m.actualBoundingBoxDescent)
			};

			return res
		} else {
			return customMeasureText(text, fontSize)
		}
	}

	class Text extends DisplayObject {
		constructor (text, fontProperty) {
			super();

			this.renderable = true;

			this.text = text;
			this.nowrap = true;
			this.fontFamily = 'Times';
			this.fontSize = 16;
			this.fontStyle = 'normal';
			this.letterSpacing = 0;
			this.lineHeight = 0;
			this.color = '#000';
			this.width = 200;

			this.shadowColor = '#fff';
			this.shadowOffsetX = 0;
			this.shadowOffsetY = 0;
			this.shadowBlur = 0;

			this.wordBreak = 'breakAll';
		}

		draw (ctx) {
			ctx.font = this.font;
			ctx.fillStyle = this.color;
			ctx.shadowColor = this.shadowColor;
			ctx.shadowOffsetX = this.shadowOffsetX;
			ctx.shadowOffsetY = this.shadowOffsetY;
			ctx.shadowBlur = this.shadowBlur;
			const m = measureText(this.text, this.fontSize);
			const { x, y } = this.position;
			const pos = { x, y };

			const height = m.height;
			this.lineHeight = this.lineHeight || height;
			const baseY = m.actualBoundingBoxAscent + 2.36 + (this.lineHeight - height) / 2;

			pos.y += baseY;


			const strPool = [];

			const checkSingleWord = (word) => {
				const m = measureText(word, this.fontSize);
				const countSpacing = m.width + word.length * this.letterSpacing;
				let subKey = 0;
				if (m.width + countSpacing > this.width) {

					const len = word.length;
					let i;
					for (i = 0; i <= len; i++) {
						const str = word.substring(subKey, i + 1);
						const currentM = measureText(str, this.fontSize);
						const currentCountSpacing = str.length * this.letterSpacing;

						if (currentM.width + currentCountSpacing > this.width) {
							strPool.push(str.substr(0, i));
							subKey = i;
						}
					}

				}

				return {
					subKey,
					text: word.substr(subKey)
				}
			};


			if (this.letterSpacing) {
				if (this.nowrap) {
					strPool.push(this.text);
				} else {
					if (this.wordBreak == 'breakWord') {
						let pool = convertStringToArrayBySpace(this.text, ' ');

						const len = pool.length;
						let currentIdx = 0;
						let preStr = '';

						for (let i = 0; i <= len; i++) {
							const words = pool.slice(currentIdx, i + 1).join('');
							const currentM = measureText(words, this.fontSize);
							const countLetterSpacing = this.letterSpacing * words.length;
							if (currentM.width + countLetterSpacing > this.width) {

								if (i == 0) {
									const res = checkSingleWord(pool[i]);
									if (res.subKey > 0) {
										pool[i] = res.text + pool[i];
									}

								} else {
									const currentWords = pool.slice(currentIdx, i).join('');
									currentIdx = i;
									const res = checkSingleWord(currentWords);
									if (res.subKey > 0) {
										preStr = res.text;
									} else {
										strPool.push(preStr + currentWords);
										preStr = '';
									}
								}
							}
						}

						if (preStr) {
							strPool.push(preStr);
						}

						if (currentIdx <= len - 1) {
							const currentWords = pool.slice(currentIdx, len).join('');
							strPool.push(currentWords);
						}

					} else {
						const len = this.text.length;
						let currentIdx = 0;
						for (let i = 0; i < len; i++) {
							const localStr = this.text.substring(currentIdx, i + 1);
							const mLocal = measureText(localStr, this.fontSize);
							const countStrSpacing = localStr.length * this.letterSpacing;
							if (mLocal.width + countStrSpacing > this.width) {
								const currentStr = this.text.substring(currentIdx, i);
								strPool.push(currentStr);
								currentIdx = i;
							}
						}

						if (currentIdx <= len - 1) {
							strPool.push(this.text.substring(currentIdx, len));
						}
					}
				}
			} else {
				if (this.nowrap) {
					ctx.fillText(this.text, pos.x, pos.y);
				} else {
					if (this.wordBreak == 'breakAll') {
						let len = this.text.length;
						let subKey = 0;
						let i;
						for (i = 1; i < len; i++) {
							let str = this.text.substring(subKey, i);
							let currentM = measureText(str, this.fontSize);
							if (currentM.width > this.width) {
								strPool.push(str.substr(0, str.length - 1));
								subKey = i - 1;
							}
						}

						strPool.push(this.text.slice(subKey, i));
					} else if (this.wordBreak == 'breakWord') {
						let pool = convertStringToArrayBySpace(this.text, ' ');
						const len = pool.length;
						let str;
						let currentIdx = 0;
						for (let i = 0; i < len; i++) {
							str = pool.slice(currentIdx , i + 1).join('');
							let currentM = measureText(str, this.fontSize);
							if (currentM.width > this.width) {
								let localStr = pool.slice(currentIdx, i).join('');
								currentIdx = i;
								strPool.push(localStr);
							}
						}

						if (currentIdx <= len - 1) {
							strPool.push(pool.slice(currentIdx).join(''));
						}
					}
				}
			}

			strPool.forEach((lineStr, index) => {
				this.fillTextLine(ctx, lineStr, pos.x, pos.y);
				pos.y += this.lineHeight;
			});
		}

		fillTextLine (ctx, text, x, y) {
			const pos = { x, y };

			if (this.letterSpacing) {
				Array.from(text).forEach((letter, index) => {
					let mLocal = measureText(letter, this.fontSize);

					ctx.fillText(letter, pos.x, pos.y);

					pos.x += mLocal.width + this.letterSpacing;
				});
			} else {
				ctx.fillText(text, pos.x, pos.y);
			}
		}

		get font () {
			return `${this.fontStyle} ${this.fontSize}px ${this.fontFamily}`
		}

		render (ctx) {
			this.draw(ctx);
		}
	}

	class Sprite extends DisplayObject {
		constructor (arg) {
			super();

			if (!arg || !isString(arg)) {
				throw new Error('')
			}

			this.anchor = new Point(0, 0);

			this.width = 1;
			this.height = 1;

			this.renderable = true;


			let img = shared.resource[arg];
			if (img) {
				this.baseImage = img;
				this.width = img.width;
				this.height = img.height;
			} else {
				this.renderable = false;
			}

		}

		get mask () {
			return this.maskDisplayObject
		}
		set mask (maskVal) {
			if (!(this.maskDisplayObject === maskVal)) {
				if (maskVal instanceof DisplayObject) {
					maskVal._ismask = true;
					maskVal._maskbind = this;
				} else {
					if (this.maskDisplayObject instanceof DisplayObject)
						this.maskDisplayObject._ismask = false;
						delete this.maskDisplayObject._maskbind;
				}

				this.maskDisplayObject = maskVal;
			}
		}

		get min () {
			return minArr([this.width, this.height])
		}

		render (ctx, force = false) {

			if (this.maskDisplayObject && !force) return

			this._draw(ctx);
		}

		_draw(ctx) {
			ctx.drawImage(
				this.baseImage,
				-this.anchor.x * this.width,
				-this.anchor.y * this.height,
				this.width,
				this.height,


			);
		}

		static from (name) {
			return new Sprite(name)
		}
	}

	class DisplayObjectContainer extends DisplayObject {
		constructor () {
			super();

			this.children = [];
			this.renderable = false;
		}

		updateTransform () {
			DisplayObject.prototype.updateTransform.call(this);

			const len = this.children.length;
			for (let i = 0; i < len; i++) {
				const child = this.children[i];
				child.updateTransform();
			}
		}

		addChild(...children) {
			this.children.push(...children.map(child => {
				let parent = child.parent;
				if (parent) {
					parent.removeChild(child);
				}

				child.parent = this;
				return child
			}));
		}

		removeChild(child) {
			child.parent = null;
			remove(this.children, child);
		}
	}

	const now = Date.now || function () {
		return new Date().getTime()
	};

	let id = 0;
	class Animation extends EventEmitter {
		constructor (sprite, action) {
			super();
			this._id = `_${++id}`;
			this.action = action;
			this.sprite = sprite;
			this._started = false;
			this._ended = false;
			this._active = false;
		}

		update (delta) {
			if (!this._started) {
				this.dispatchEvent('start', delta);
				this._started = true;
				this._active = true;
			}
			this._ended = this.action.update(this.sprite, delta);

			if (this._ended && this._active) {
				this.dispatchEvent('end', delta);
				this._active = false;
			}
		}

		isEnded () {
			return this._ended
		}
	}

	class ActionManager {
		constructor () {
			this.actions = {};
			this._actionsToDelete = [];

			this._last = 0;
		}

		runAction (sprite, action) {
			const animation = new Animation(sprite, action);
			this.actions[animation._id] = animation;
			return animation
		}

		cancelAction (animation) {
			this._actionsToDelete.push(animation);
		}

		update (delta) {
			if (!delta && delta !== 0) {
				delta = this._getDeltaMS();
			}

			for (const _id in this.actions) {
				if (Object.prototype.hasOwnProperty.call(this.actions, _id)) {
					const animation = this.actions[_id];
					animation.update(delta);
					if (animation.isEnded()) {
						this._actionsToDelete.push(animation);
					}
				}
			}

			if (this._actionsToDelete.length) {
				for (let i = 0; i < this._actionsToDelete.length; i++) {
					this._remove(this._actionsToDelete[i]);
				}
				this._actionsToDelete.length = 0;
			}
		}

		_remove (animation) {
			delete this.actions[animation._id];
		}

		_getDeltaMS () {
			if (this._last === 0) { this._last = now(); }
			const deltaMS = now() - this._last;
			this._last = now();
			return deltaMS
		}
	}

	const { abs: abs$1, cos: cos$1, sin: sin$1, acos: acos$1, atan2, sqrt: sqrt$1, pow } = Math;

	function crt(v) {
	  return v < 0 ? -pow(-v, 1 / 3) : pow(v, 1 / 3);
	}

	const pi$1 = Math.PI,
	  tau = 2 * pi$1,
	  quart = pi$1 / 2,
	  epsilon = 0.000001,
	  nMax = Number.MAX_SAFE_INTEGER || 9007199254740991,
	  nMin = Number.MIN_SAFE_INTEGER || -9007199254740991,
	  ZERO = { x: 0, y: 0, z: 0 };

	const utils = {
	  Tvalues: [
	    -0.0640568928626056260850430826247450385909,
	    0.0640568928626056260850430826247450385909,
	    -0.1911188674736163091586398207570696318404,
	    0.1911188674736163091586398207570696318404,
	    -0.3150426796961633743867932913198102407864,
	    0.3150426796961633743867932913198102407864,
	    -0.4337935076260451384870842319133497124524,
	    0.4337935076260451384870842319133497124524,
	    -0.5454214713888395356583756172183723700107,
	    0.5454214713888395356583756172183723700107,
	    -0.6480936519369755692524957869107476266696,
	    0.6480936519369755692524957869107476266696,
	    -0.7401241915785543642438281030999784255232,
	    0.7401241915785543642438281030999784255232,
	    -0.8200019859739029219539498726697452080761,
	    0.8200019859739029219539498726697452080761,
	    -0.8864155270044010342131543419821967550873,
	    0.8864155270044010342131543419821967550873,
	    -0.9382745520027327585236490017087214496548,
	    0.9382745520027327585236490017087214496548,
	    -0.9747285559713094981983919930081690617411,
	    0.9747285559713094981983919930081690617411,
	    -0.9951872199970213601799974097007368118745,
	    0.9951872199970213601799974097007368118745,
	  ],

	  Cvalues: [
	    0.1279381953467521569740561652246953718517,
	    0.1279381953467521569740561652246953718517,
	    0.1258374563468282961213753825111836887264,
	    0.1258374563468282961213753825111836887264,
	    0.121670472927803391204463153476262425607,
	    0.121670472927803391204463153476262425607,
	    0.1155056680537256013533444839067835598622,
	    0.1155056680537256013533444839067835598622,
	    0.1074442701159656347825773424466062227946,
	    0.1074442701159656347825773424466062227946,
	    0.0976186521041138882698806644642471544279,
	    0.0976186521041138882698806644642471544279,
	    0.086190161531953275917185202983742667185,
	    0.086190161531953275917185202983742667185,
	    0.0733464814110803057340336152531165181193,
	    0.0733464814110803057340336152531165181193,
	    0.0592985849154367807463677585001085845412,
	    0.0592985849154367807463677585001085845412,
	    0.0442774388174198061686027482113382288593,
	    0.0442774388174198061686027482113382288593,
	    0.0285313886289336631813078159518782864491,
	    0.0285313886289336631813078159518782864491,
	    0.0123412297999871995468056670700372915759,
	    0.0123412297999871995468056670700372915759,
	  ],

	  arcfn: function (t, derivativeFn) {
	    const d = derivativeFn(t);
	    let l = d.x * d.x + d.y * d.y;
	    if (typeof d.z !== "undefined") {
	      l += d.z * d.z;
	    }
	    return sqrt$1(l);
	  },

	  compute: function (t, points, _3d) {
	    if (t === 0) {
	      points[0].t = 0;
	      return points[0];
	    }

	    const order = points.length - 1;

	    if (t === 1) {
	      points[order].t = 1;
	      return points[order];
	    }

	    const mt = 1 - t;
	    let p = points;

	    if (order === 0) {
	      points[0].t = t;
	      return points[0];
	    }

	    if (order === 1) {
	      const ret = {
	        x: mt * p[0].x + t * p[1].x,
	        y: mt * p[0].y + t * p[1].y,
	        t: t,
	      };
	      if (_3d) {
	        ret.z = mt * p[0].z + t * p[1].z;
	      }
	      return ret;
	    }

	    if (order < 4) {
	      let mt2 = mt * mt,
	        t2 = t * t,
	        a,
	        b,
	        c,
	        d = 0;
	      if (order === 2) {
	        p = [p[0], p[1], p[2], ZERO];
	        a = mt2;
	        b = mt * t * 2;
	        c = t2;
	      } else if (order === 3) {
	        a = mt2 * mt;
	        b = mt2 * t * 3;
	        c = mt * t2 * 3;
	        d = t * t2;
	      }
	      const ret = {
	        x: a * p[0].x + b * p[1].x + c * p[2].x + d * p[3].x,
	        y: a * p[0].y + b * p[1].y + c * p[2].y + d * p[3].y,
	        t: t,
	      };
	      if (_3d) {
	        ret.z = a * p[0].z + b * p[1].z + c * p[2].z + d * p[3].z;
	      }
	      return ret;
	    }

	    const dCpts = JSON.parse(JSON.stringify(points));
	    while (dCpts.length > 1) {
	      for (let i = 0; i < dCpts.length - 1; i++) {
	        dCpts[i] = {
	          x: dCpts[i].x + (dCpts[i + 1].x - dCpts[i].x) * t,
	          y: dCpts[i].y + (dCpts[i + 1].y - dCpts[i].y) * t,
	        };
	        if (typeof dCpts[i].z !== "undefined") {
	          dCpts[i] = dCpts[i].z + (dCpts[i + 1].z - dCpts[i].z) * t;
	        }
	      }
	      dCpts.splice(dCpts.length - 1, 1);
	    }
	    dCpts[0].t = t;
	    return dCpts[0];
	  },

	  computeWithRatios: function (t, points, ratios, _3d) {
	    const mt = 1 - t,
	      r = ratios,
	      p = points;

	    let f1 = r[0],
	      f2 = r[1],
	      f3 = r[2],
	      f4 = r[3],
	      d;

	    f1 *= mt;
	    f2 *= t;

	    if (p.length === 2) {
	      d = f1 + f2;
	      return {
	        x: (f1 * p[0].x + f2 * p[1].x) / d,
	        y: (f1 * p[0].y + f2 * p[1].y) / d,
	        z: !_3d ? false : (f1 * p[0].z + f2 * p[1].z) / d,
	        t: t,
	      };
	    }

	    f1 *= mt;
	    f2 *= 2 * mt;
	    f3 *= t * t;

	    if (p.length === 3) {
	      d = f1 + f2 + f3;
	      return {
	        x: (f1 * p[0].x + f2 * p[1].x + f3 * p[2].x) / d,
	        y: (f1 * p[0].y + f2 * p[1].y + f3 * p[2].y) / d,
	        z: !_3d ? false : (f1 * p[0].z + f2 * p[1].z + f3 * p[2].z) / d,
	        t: t,
	      };
	    }

	    // upgrade to cubic
	    f1 *= mt;
	    f2 *= 1.5 * mt;
	    f3 *= 3 * mt;
	    f4 *= t * t * t;

	    if (p.length === 4) {
	      d = f1 + f2 + f3 + f4;
	      return {
	        x: (f1 * p[0].x + f2 * p[1].x + f3 * p[2].x + f4 * p[3].x) / d,
	        y: (f1 * p[0].y + f2 * p[1].y + f3 * p[2].y + f4 * p[3].y) / d,
	        z: !_3d
	          ? false
	          : (f1 * p[0].z + f2 * p[1].z + f3 * p[2].z + f4 * p[3].z) / d,
	        t: t,
	      };
	    }
	  },

	  derive: function (points, _3d) {
	    const dpoints = [];
	    for (let p = points, d = p.length, c = d - 1; d > 1; d--, c--) {
	      const list = [];
	      for (let j = 0, dpt; j < c; j++) {
	        dpt = {
	          x: c * (p[j + 1].x - p[j].x),
	          y: c * (p[j + 1].y - p[j].y),
	        };
	        if (_3d) {
	          dpt.z = c * (p[j + 1].z - p[j].z);
	        }
	        list.push(dpt);
	      }
	      dpoints.push(list);
	      p = list;
	    }
	    return dpoints;
	  },

	  between: function (v, m, M) {
	    return (
	      (m <= v && v <= M) ||
	      utils.approximately(v, m) ||
	      utils.approximately(v, M)
	    );
	  },

	  approximately: function (a, b, precision) {
	    return abs$1(a - b) <= (precision || epsilon);
	  },

	  length: function (derivativeFn) {
	    const z = 0.5,
	      len = utils.Tvalues.length;

	    let sum = 0;

	    for (let i = 0, t; i < len; i++) {
	      t = z * utils.Tvalues[i] + z;
	      sum += utils.Cvalues[i] * utils.arcfn(t, derivativeFn);
	    }
	    return z * sum;
	  },

	  map: function (v, ds, de, ts, te) {
	    const d1 = de - ds,
	      d2 = te - ts,
	      v2 = v - ds,
	      r = v2 / d1;
	    return ts + d2 * r;
	  },

	  lerp: function (r, v1, v2) {
	    const ret = {
	      x: v1.x + r * (v2.x - v1.x),
	      y: v1.y + r * (v2.y - v1.y),
	    };
	    if (!!v1.z && !!v2.z) {
	      ret.z = v1.z + r * (v2.z - v1.z);
	    }
	    return ret;
	  },

	  pointToString: function (p) {
	    let s = p.x + "/" + p.y;
	    if (typeof p.z !== "undefined") {
	      s += "/" + p.z;
	    }
	    return s;
	  },

	  pointsToString: function (points) {
	    return "[" + points.map(utils.pointToString).join(", ") + "]";
	  },

	  copy: function (obj) {
	    return JSON.parse(JSON.stringify(obj));
	  },

	  angle: function (o, v1, v2) {
	    const dx1 = v1.x - o.x,
	      dy1 = v1.y - o.y,
	      dx2 = v2.x - o.x,
	      dy2 = v2.y - o.y,
	      cross = dx1 * dy2 - dy1 * dx2,
	      dot = dx1 * dx2 + dy1 * dy2;
	    return atan2(cross, dot);
	  },

	  // round as string, to avoid rounding errors
	  round: function (v, d) {
	    const s = "" + v;
	    const pos = s.indexOf(".");
	    return parseFloat(s.substring(0, pos + 1 + d));
	  },

	  dist: function (p1, p2) {
	    const dx = p1.x - p2.x,
	      dy = p1.y - p2.y;
	    return sqrt$1(dx * dx + dy * dy);
	  },

	  closest: function (LUT, point) {
	    let mdist = pow(2, 63),
	      mpos,
	      d;
	    LUT.forEach(function (p, idx) {
	      d = utils.dist(point, p);
	      if (d < mdist) {
	        mdist = d;
	        mpos = idx;
	      }
	    });
	    return { mdist: mdist, mpos: mpos };
	  },

	  abcratio: function (t, n) {
	    if (n !== 2 && n !== 3) {
	      return false;
	    }
	    if (typeof t === "undefined") {
	      t = 0.5;
	    } else if (t === 0 || t === 1) {
	      return t;
	    }
	    const bottom = pow(t, n) + pow(1 - t, n),
	      top = bottom - 1;
	    return abs$1(top / bottom);
	  },

	  projectionratio: function (t, n) {
	    if (n !== 2 && n !== 3) {
	      return false;
	    }
	    if (typeof t === "undefined") {
	      t = 0.5;
	    } else if (t === 0 || t === 1) {
	      return t;
	    }
	    const top = pow(1 - t, n),
	      bottom = pow(t, n) + top;
	    return top / bottom;
	  },

	  lli8: function (x1, y1, x2, y2, x3, y3, x4, y4) {
	    const nx =
	        (x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4),
	      ny = (x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4),
	      d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
	    if (d == 0) {
	      return false;
	    }
	    return { x: nx / d, y: ny / d };
	  },

	  lli4: function (p1, p2, p3, p4) {
	    const x1 = p1.x,
	      y1 = p1.y,
	      x2 = p2.x,
	      y2 = p2.y,
	      x3 = p3.x,
	      y3 = p3.y,
	      x4 = p4.x,
	      y4 = p4.y;
	    return utils.lli8(x1, y1, x2, y2, x3, y3, x4, y4);
	  },

	  lli: function (v1, v2) {
	    return utils.lli4(v1, v1.c, v2, v2.c);
	  },

	  makeline: function (p1, p2) {
	    const x1 = p1.x,
	      y1 = p1.y,
	      x2 = p2.x,
	      y2 = p2.y,
	      dx = (x2 - x1) / 3,
	      dy = (y2 - y1) / 3;
	    return new Bezier(
	      x1,
	      y1,
	      x1 + dx,
	      y1 + dy,
	      x1 + 2 * dx,
	      y1 + 2 * dy,
	      x2,
	      y2
	    );
	  },

	  findbbox: function (sections) {
	    let mx = nMax,
	      my = nMax,
	      MX = nMin,
	      MY = nMin;
	    sections.forEach(function (s) {
	      const bbox = s.bbox();
	      if (mx > bbox.x.min) mx = bbox.x.min;
	      if (my > bbox.y.min) my = bbox.y.min;
	      if (MX < bbox.x.max) MX = bbox.x.max;
	      if (MY < bbox.y.max) MY = bbox.y.max;
	    });
	    return {
	      x: { min: mx, mid: (mx + MX) / 2, max: MX, size: MX - mx },
	      y: { min: my, mid: (my + MY) / 2, max: MY, size: MY - my },
	    };
	  },

	  shapeintersections: function (
	    s1,
	    bbox1,
	    s2,
	    bbox2,
	    curveIntersectionThreshold
	  ) {
	    if (!utils.bboxoverlap(bbox1, bbox2)) return [];
	    const intersections = [];
	    const a1 = [s1.startcap, s1.forward, s1.back, s1.endcap];
	    const a2 = [s2.startcap, s2.forward, s2.back, s2.endcap];
	    a1.forEach(function (l1) {
	      if (l1.virtual) return;
	      a2.forEach(function (l2) {
	        if (l2.virtual) return;
	        const iss = l1.intersects(l2, curveIntersectionThreshold);
	        if (iss.length > 0) {
	          iss.c1 = l1;
	          iss.c2 = l2;
	          iss.s1 = s1;
	          iss.s2 = s2;
	          intersections.push(iss);
	        }
	      });
	    });
	    return intersections;
	  },

	  makeshape: function (forward, back, curveIntersectionThreshold) {
	    const bpl = back.points.length;
	    const fpl = forward.points.length;
	    const start = utils.makeline(back.points[bpl - 1], forward.points[0]);
	    const end = utils.makeline(forward.points[fpl - 1], back.points[0]);
	    const shape = {
	      startcap: start,
	      forward: forward,
	      back: back,
	      endcap: end,
	      bbox: utils.findbbox([start, forward, back, end]),
	    };
	    shape.intersections = function (s2) {
	      return utils.shapeintersections(
	        shape,
	        shape.bbox,
	        s2,
	        s2.bbox,
	        curveIntersectionThreshold
	      );
	    };
	    return shape;
	  },

	  getminmax: function (curve, d, list) {
	    if (!list) return { min: 0, max: 0 };
	    let min = nMax,
	      max = nMin,
	      t,
	      c;
	    if (list.indexOf(0) === -1) {
	      list = [0].concat(list);
	    }
	    if (list.indexOf(1) === -1) {
	      list.push(1);
	    }
	    for (let i = 0, len = list.length; i < len; i++) {
	      t = list[i];
	      c = curve.get(t);
	      if (c[d] < min) {
	        min = c[d];
	      }
	      if (c[d] > max) {
	        max = c[d];
	      }
	    }
	    return { min: min, mid: (min + max) / 2, max: max, size: max - min };
	  },

	  align: function (points, line) {
	    const tx = line.p1.x,
	      ty = line.p1.y,
	      a = -atan2(line.p2.y - ty, line.p2.x - tx),
	      d = function (v) {
	        return {
	          x: (v.x - tx) * cos$1(a) - (v.y - ty) * sin$1(a),
	          y: (v.x - tx) * sin$1(a) + (v.y - ty) * cos$1(a),
	        };
	      };
	    return points.map(d);
	  },

	  roots: function (points, line) {
	    line = line || { p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 } };

	    const order = points.length - 1;
	    const aligned = utils.align(points, line);
	    const reduce = function (t) {
	      return 0 <= t && t <= 1;
	    };

	    if (order === 2) {
	      const a = aligned[0].y,
	        b = aligned[1].y,
	        c = aligned[2].y,
	        d = a - 2 * b + c;
	      if (d !== 0) {
	        const m1 = -sqrt$1(b * b - a * c),
	          m2 = -a + b,
	          v1 = -(m1 + m2) / d,
	          v2 = -(-m1 + m2) / d;
	        return [v1, v2].filter(reduce);
	      } else if (b !== c && d === 0) {
	        return [(2 * b - c) / (2 * b - 2 * c)].filter(reduce);
	      }
	      return [];
	    }

	    const pa = aligned[0].y,
	      pb = aligned[1].y,
	      pc = aligned[2].y,
	      pd = aligned[3].y;

	    let d = -pa + 3 * pb - 3 * pc + pd,
	      a = 3 * pa - 6 * pb + 3 * pc,
	      b = -3 * pa + 3 * pb,
	      c = pa;

	    if (utils.approximately(d, 0)) {
	      if (utils.approximately(a, 0)) {
	        if (utils.approximately(b, 0)) {
	          return [];
	        }
	        return [-c / b].filter(reduce);
	      }
	      const q = sqrt$1(b * b - 4 * a * c),
	        a2 = 2 * a;
	      return [(q - b) / a2, (-b - q) / a2].filter(reduce);
	    }


	    a /= d;
	    b /= d;
	    c /= d;

	    const p = (3 * b - a * a) / 3,
	      p3 = p / 3,
	      q = (2 * a * a * a - 9 * a * b + 27 * c) / 27,
	      q2 = q / 2,
	      discriminant = q2 * q2 + p3 * p3 * p3;

	    let u1, v1, x1, x2, x3;
	    if (discriminant < 0) {
	      const mp3 = -p / 3,
	        mp33 = mp3 * mp3 * mp3,
	        r = sqrt$1(mp33),
	        t = -q / (2 * r),
	        cosphi = t < -1 ? -1 : t > 1 ? 1 : t,
	        phi = acos$1(cosphi),
	        crtr = crt(r),
	        t1 = 2 * crtr;
	      x1 = t1 * cos$1(phi / 3) - a / 3;
	      x2 = t1 * cos$1((phi + tau) / 3) - a / 3;
	      x3 = t1 * cos$1((phi + 2 * tau) / 3) - a / 3;
	      return [x1, x2, x3].filter(reduce);
	    } else if (discriminant === 0) {
	      u1 = q2 < 0 ? crt(-q2) : -crt(q2);
	      x1 = 2 * u1 - a / 3;
	      x2 = -u1 - a / 3;
	      return [x1, x2].filter(reduce);
	    } else {
	      const sd = sqrt$1(discriminant);
	      u1 = crt(-q2 + sd);
	      v1 = crt(q2 + sd);
	      return [u1 - v1 - a / 3].filter(reduce);
	    }
	  },

	  droots: function (p) {
	    if (p.length === 3) {
	      const a = p[0],
	        b = p[1],
	        c = p[2],
	        d = a - 2 * b + c;
	      if (d !== 0) {
	        const m1 = -sqrt$1(b * b - a * c),
	          m2 = -a + b,
	          v1 = -(m1 + m2) / d,
	          v2 = -(-m1 + m2) / d;
	        return [v1, v2];
	      } else if (b !== c && d === 0) {
	        return [(2 * b - c) / (2 * (b - c))];
	      }
	      return [];
	    }

	    if (p.length === 2) {
	      const a = p[0],
	        b = p[1];
	      if (a !== b) {
	        return [a / (a - b)];
	      }
	      return [];
	    }

	    return [];
	  },

	  curvature: function (t, d1, d2, _3d, kOnly) {
	    let num,
	      dnm,
	      adk,
	      dk,
	      k = 0,
	      r = 0;

	    const d = utils.compute(t, d1);
	    const dd = utils.compute(t, d2);
	    const qdsum = d.x * d.x + d.y * d.y;

	    if (_3d) {
	      num = sqrt$1(
	        pow(d.y * dd.z - dd.y * d.z, 2) +
	          pow(d.z * dd.x - dd.z * d.x, 2) +
	          pow(d.x * dd.y - dd.x * d.y, 2)
	      );
	      dnm = pow(qdsum + d.z * d.z, 3 / 2);
	    } else {
	      num = d.x * dd.y - d.y * dd.x;
	      dnm = pow(qdsum, 3 / 2);
	    }

	    if (num === 0 || dnm === 0) {
	      return { k: 0, r: 0 };
	    }

	    k = num / dnm;
	    r = dnm / num;

	    if (!kOnly) {
	      const pk = utils.curvature(t - 0.001, d1, d2, _3d, true).k;
	      const nk = utils.curvature(t + 0.001, d1, d2, _3d, true).k;
	      dk = (nk - k + (k - pk)) / 2;
	      adk = (abs$1(nk - k) + abs$1(k - pk)) / 2;
	    }

	    return { k: k, r: r, dk: dk, adk: adk };
	  },

	  inflections: function (points) {
	    if (points.length < 4) return [];

	    const p = utils.align(points, { p1: points[0], p2: points.slice(-1)[0] }),
	      a = p[2].x * p[1].y,
	      b = p[3].x * p[1].y,
	      c = p[1].x * p[2].y,
	      d = p[3].x * p[2].y,
	      v1 = 18 * (-3 * a + 2 * b + 3 * c - d),
	      v2 = 18 * (3 * a - b - 3 * c),
	      v3 = 18 * (c - a);

	    if (utils.approximately(v1, 0)) {
	      if (!utils.approximately(v2, 0)) {
	        let t = -v3 / v2;
	        if (0 <= t && t <= 1) return [t];
	      }
	      return [];
	    }

	    const trm = v2 * v2 - 4 * v1 * v3,
	      sq = Math.sqrt(trm),
	      d2 = 2 * v1;

	    if (utils.approximately(d2, 0)) return [];

	    return [(sq - v2) / d2, -(v2 + sq) / d2].filter(function (r) {
	      return 0 <= r && r <= 1;
	    });
	  },

	  bboxoverlap: function (b1, b2) {
	    const dims = ["x", "y"],
	      len = dims.length;

	    for (let i = 0, dim, l, t, d; i < len; i++) {
	      dim = dims[i];
	      l = b1[dim].mid;
	      t = b2[dim].mid;
	      d = (b1[dim].size + b2[dim].size) / 2;
	      if (abs$1(l - t) >= d) return false;
	    }
	    return true;
	  },

	  expandbox: function (bbox, _bbox) {
	    if (_bbox.x.min < bbox.x.min) {
	      bbox.x.min = _bbox.x.min;
	    }
	    if (_bbox.y.min < bbox.y.min) {
	      bbox.y.min = _bbox.y.min;
	    }
	    if (_bbox.z && _bbox.z.min < bbox.z.min) {
	      bbox.z.min = _bbox.z.min;
	    }
	    if (_bbox.x.max > bbox.x.max) {
	      bbox.x.max = _bbox.x.max;
	    }
	    if (_bbox.y.max > bbox.y.max) {
	      bbox.y.max = _bbox.y.max;
	    }
	    if (_bbox.z && _bbox.z.max > bbox.z.max) {
	      bbox.z.max = _bbox.z.max;
	    }
	    bbox.x.mid = (bbox.x.min + bbox.x.max) / 2;
	    bbox.y.mid = (bbox.y.min + bbox.y.max) / 2;
	    if (bbox.z) {
	      bbox.z.mid = (bbox.z.min + bbox.z.max) / 2;
	    }
	    bbox.x.size = bbox.x.max - bbox.x.min;
	    bbox.y.size = bbox.y.max - bbox.y.min;
	    if (bbox.z) {
	      bbox.z.size = bbox.z.max - bbox.z.min;
	    }
	  },

	  pairiteration: function (c1, c2, curveIntersectionThreshold) {
	    const c1b = c1.bbox(),
	      c2b = c2.bbox(),
	      r = 100000,
	      threshold = curveIntersectionThreshold || 0.5;

	    if (
	      c1b.x.size + c1b.y.size < threshold &&
	      c2b.x.size + c2b.y.size < threshold
	    ) {
	      return [
	        (((r * (c1._t1 + c1._t2)) / 2) | 0) / r +
	          "/" +
	          (((r * (c2._t1 + c2._t2)) / 2) | 0) / r,
	      ];
	    }

	    let cc1 = c1.split(0.5),
	      cc2 = c2.split(0.5),
	      pairs = [
	        { left: cc1.left, right: cc2.left },
	        { left: cc1.left, right: cc2.right },
	        { left: cc1.right, right: cc2.right },
	        { left: cc1.right, right: cc2.left },
	      ];

	    pairs = pairs.filter(function (pair) {
	      return utils.bboxoverlap(pair.left.bbox(), pair.right.bbox());
	    });

	    let results = [];

	    if (pairs.length === 0) return results;

	    pairs.forEach(function (pair) {
	      results = results.concat(
	        utils.pairiteration(pair.left, pair.right, threshold)
	      );
	    });

	    results = results.filter(function (v, i) {
	      return results.indexOf(v) === i;
	    });

	    return results;
	  },

	  getccenter: function (p1, p2, p3) {
	    const dx1 = p2.x - p1.x,
	      dy1 = p2.y - p1.y,
	      dx2 = p3.x - p2.x,
	      dy2 = p3.y - p2.y,
	      dx1p = dx1 * cos$1(quart) - dy1 * sin$1(quart),
	      dy1p = dx1 * sin$1(quart) + dy1 * cos$1(quart),
	      dx2p = dx2 * cos$1(quart) - dy2 * sin$1(quart),
	      dy2p = dx2 * sin$1(quart) + dy2 * cos$1(quart),
	      // chord midpoints
	      mx1 = (p1.x + p2.x) / 2,
	      my1 = (p1.y + p2.y) / 2,
	      mx2 = (p2.x + p3.x) / 2,
	      my2 = (p2.y + p3.y) / 2,
	      // midpoint offsets
	      mx1n = mx1 + dx1p,
	      my1n = my1 + dy1p,
	      mx2n = mx2 + dx2p,
	      my2n = my2 + dy2p,
	      // intersection of these lines:
	      arc = utils.lli8(mx1, my1, mx1n, my1n, mx2, my2, mx2n, my2n),
	      r = utils.dist(arc, p1);

	    // arc start/end values, over mid point:
	    let s = atan2(p1.y - arc.y, p1.x - arc.x),
	      m = atan2(p2.y - arc.y, p2.x - arc.x),
	      e = atan2(p3.y - arc.y, p3.x - arc.x),
	      _;

	    // determine arc direction (cw/ccw correction)
	    if (s < e) {
	      // if s<m<e, arc(s, e)
	      // if m<s<e, arc(e, s + tau)
	      // if s<e<m, arc(e, s + tau)
	      if (s > m || m > e) {
	        s += tau;
	      }
	      if (s > e) {
	        _ = e;
	        e = s;
	        s = _;
	      }
	    } else {
	      // if e<m<s, arc(e, s)
	      // if m<e<s, arc(s, e + tau)
	      // if e<s<m, arc(s, e + tau)
	      if (e < m && m < s) {
	        _ = e;
	        e = s;
	        s = _;
	      } else {
	        e += tau;
	      }
	    }
	    // assign and done.
	    arc.s = s;
	    arc.e = e;
	    arc.r = r;
	    return arc;
	  },

	  numberSort: function (a, b) {
	    return a - b;
	  },
	};

	/**
	 * Poly Bezier
	 * @param {[type]} curves [description]
	 */
	class PolyBezier {
	  constructor(curves) {
	    this.curves = [];
	    this._3d = false;
	    if (!!curves) {
	      this.curves = curves;
	      this._3d = this.curves[0]._3d;
	    }
	  }

	  valueOf() {
	    return this.toString();
	  }

	  toString() {
	    return (
	      "[" +
	      this.curves
	        .map(function (curve) {
	          return utils.pointsToString(curve.points);
	        })
	        .join(", ") +
	      "]"
	    );
	  }

	  addCurve(curve) {
	    this.curves.push(curve);
	    this._3d = this._3d || curve._3d;
	  }

	  length() {
	    return this.curves
	      .map(function (v) {
	        return v.length();
	      })
	      .reduce(function (a, b) {
	        return a + b;
	      });
	  }

	  curve(idx) {
	    return this.curves[idx];
	  }

	  bbox() {
	    const c = this.curves;
	    var bbox = c[0].bbox();
	    for (var i = 1; i < c.length; i++) {
	      utils.expandbox(bbox, c[i].bbox());
	    }
	    return bbox;
	  }

	  offset(d) {
	    const offset = [];
	    this.curves.forEach(function (v) {
	      offset.push(...v.offset(d));
	    });
	    return new PolyBezier(offset);
	  }
	}

	const { abs, min, max, cos, sin, acos, sqrt } = Math;
	const pi = Math.PI;

	class Bezier {
	  constructor(coords) {
	    let args =
	      coords && coords.forEach ? coords : Array.from(arguments).slice();
	    let coordlen = false;

	    if (typeof args[0] === "object") {
	      coordlen = args.length;
	      const newargs = [];
	      args.forEach(function (point) {
	        ["x", "y", "z"].forEach(function (d) {
	          if (typeof point[d] !== "undefined") {
	            newargs.push(point[d]);
	          }
	        });
	      });
	      args = newargs;
	    }

	    let higher = false;
	    const len = args.length;

	    if (coordlen) {
	      if (coordlen > 4) {
	        if (arguments.length !== 1) {
	          throw new Error(
	            "Only new Bezier(point[]) is accepted for 4th and higher order curves"
	          );
	        }
	        higher = true;
	      }
	    } else {
	      if (len !== 6 && len !== 8 && len !== 9 && len !== 12) {
	        if (arguments.length !== 1) {
	          throw new Error(
	            "Only new Bezier(point[]) is accepted for 4th and higher order curves"
	          );
	        }
	      }
	    }

	    const _3d = (this._3d =
	      (!higher && (len === 9 || len === 12)) ||
	      (coords && coords[0] && typeof coords[0].z !== "undefined"));

	    const points = (this.points = []);
	    for (let idx = 0, step = _3d ? 3 : 2; idx < len; idx += step) {
	      var point = {
	        x: args[idx],
	        y: args[idx + 1],
	      };
	      if (_3d) {
	        point.z = args[idx + 2];
	      }
	      points.push(point);
	    }
	    const order = (this.order = points.length - 1);

	    const dims = (this.dims = ["x", "y"]);
	    if (_3d) dims.push("z");
	    this.dimlen = dims.length;

	    const aligned = utils.align(points, { p1: points[0], p2: points[order] });
	    this._linear = !aligned.some((p) => abs(p.y) > 0.0001);

	    this._lut = [];

	    this._t1 = 0;
	    this._t2 = 1;
	    this.update();
	  }

	  static quadraticFromPoints(p1, p2, p3, t) {
	    if (typeof t === "undefined") {
	      t = 0.5;
	    }
	    if (t === 0) {
	      return new Bezier(p2, p2, p3);
	    }
	    if (t === 1) {
	      return new Bezier(p1, p2, p2);
	    }
	    const abc = Bezier.getABC(2, p1, p2, p3, t);
	    return new Bezier(p1, abc.A, p3);
	  }

	  static cubicFromPoints(S, B, E, t, d1) {
	    if (typeof t === "undefined") {
	      t = 0.5;
	    }
	    const abc = Bezier.getABC(3, S, B, E, t);
	    if (typeof d1 === "undefined") {
	      d1 = utils.dist(B, abc.C);
	    }
	    const d2 = (d1 * (1 - t)) / t;

	    const selen = utils.dist(S, E),
	      lx = (E.x - S.x) / selen,
	      ly = (E.y - S.y) / selen,
	      bx1 = d1 * lx,
	      by1 = d1 * ly,
	      bx2 = d2 * lx,
	      by2 = d2 * ly;
	    const e1 = { x: B.x - bx1, y: B.y - by1 },
	      e2 = { x: B.x + bx2, y: B.y + by2 },
	      A = abc.A,
	      v1 = { x: A.x + (e1.x - A.x) / (1 - t), y: A.y + (e1.y - A.y) / (1 - t) },
	      v2 = { x: A.x + (e2.x - A.x) / t, y: A.y + (e2.y - A.y) / t },
	      nc1 = { x: S.x + (v1.x - S.x) / t, y: S.y + (v1.y - S.y) / t },
	      nc2 = {
	        x: E.x + (v2.x - E.x) / (1 - t),
	        y: E.y + (v2.y - E.y) / (1 - t),
	      };
	    return new Bezier(S, nc1, nc2, E);
	  }

	  static getUtils() {
	    return utils;
	  }

	  getUtils() {
	    return Bezier.getUtils();
	  }

	  static get PolyBezier() {
	    return PolyBezier;
	  }

	  valueOf() {
	    return this.toString();
	  }

	  toString() {
	    return utils.pointsToString(this.points);
	  }

	  toSVG() {
	    if (this._3d) return false;
	    const p = this.points,
	      x = p[0].x,
	      y = p[0].y,
	      s = ["M", x, y, this.order === 2 ? "Q" : "C"];
	    for (let i = 1, last = p.length; i < last; i++) {
	      s.push(p[i].x);
	      s.push(p[i].y);
	    }
	    return s.join(" ");
	  }

	  setRatios(ratios) {
	    if (ratios.length !== this.points.length) {
	      throw new Error("incorrect number of ratio values");
	    }
	    this.ratios = ratios;
	    this._lut = []; //  invalidate any precomputed LUT
	  }

	  verify() {
	    const print = this.coordDigest();
	    if (print !== this._print) {
	      this._print = print;
	      this.update();
	    }
	  }

	  coordDigest() {
	    return this.points
	      .map(function (c, pos) {
	        return "" + pos + c.x + c.y + (c.z ? c.z : 0);
	      })
	      .join("");
	  }

	  update() {
	    this._lut = [];
	    this.dpoints = utils.derive(this.points, this._3d);
	    this.computedirection();
	  }

	  computedirection() {
	    const points = this.points;
	    const angle = utils.angle(points[0], points[this.order], points[1]);
	    this.clockwise = angle > 0;
	  }

	  length() {
	    return utils.length(this.derivative.bind(this));
	  }

	  static getABC(order = 2, S, B, E, t = 0.5) {
	    const u = utils.projectionratio(t, order),
	      um = 1 - u,
	      C = {
	        x: u * S.x + um * E.x,
	        y: u * S.y + um * E.y,
	      },
	      s = utils.abcratio(t, order),
	      A = {
	        x: B.x + (B.x - C.x) / s,
	        y: B.y + (B.y - C.y) / s,
	      };
	    return { A, B, C, S, E };
	  }

	  getABC(t, B) {
	    B = B || this.get(t);
	    let S = this.points[0];
	    let E = this.points[this.order];
	    return Bezier.getABC(this.order, S, B, E, t);
	  }

	  getLUT(steps) {
	    this.verify();
	    steps = steps || 100;
	    if (this._lut.length === steps) {
	      return this._lut;
	    }
	    this._lut = [];
	    steps--;
	    for (let i = 0, p, t; i < steps; i++) {
	      t = i / (steps - 1);
	      p = this.compute(t);
	      p.t = t;
	      this._lut.push(p);
	    }
	    return this._lut;
	  }

	  on(point, error) {
	    error = error || 5;
	    const lut = this.getLUT(),
	      hits = [];
	    for (let i = 0, c, t = 0; i < lut.length; i++) {
	      c = lut[i];
	      if (utils.dist(c, point) < error) {
	        hits.push(c);
	        t += i / lut.length;
	      }
	    }
	    if (!hits.length) return false;
	    return (t /= hits.length);
	  }

	  project(point) {
	    const LUT = this.getLUT(),
	      l = LUT.length - 1,
	      closest = utils.closest(LUT, point),
	      mpos = closest.mpos,
	      t1 = (mpos - 1) / l,
	      t2 = (mpos + 1) / l,
	      step = 0.1 / l;

	    let mdist = closest.mdist,
	      t = t1,
	      ft = t,
	      p;
	    mdist += 1;
	    for (let d; t < t2 + step; t += step) {
	      p = this.compute(t);
	      d = utils.dist(point, p);
	      if (d < mdist) {
	        mdist = d;
	        ft = t;
	      }
	    }
	    ft = ft < 0 ? 0 : ft > 1 ? 1 : ft;
	    p = this.compute(ft);
	    p.t = ft;
	    p.d = mdist;
	    return p;
	  }

	  get(t) {
	    return this.compute(t);
	  }

	  point(idx) {
	    return this.points[idx];
	  }

	  compute(t) {
	    if (this.ratios) {
	      return utils.computeWithRatios(t, this.points, this.ratios, this._3d);
	    }
	    return utils.compute(t, this.points, this._3d, this.ratios);
	  }

	  raise() {
	    const p = this.points,
	      np = [p[0]],
	      k = p.length;
	    for (let i = 1, pi, pim; i < k; i++) {
	      pi = p[i];
	      pim = p[i - 1];
	      np[i] = {
	        x: ((k - i) / k) * pi.x + (i / k) * pim.x,
	        y: ((k - i) / k) * pi.y + (i / k) * pim.y,
	      };
	    }
	    np[k] = p[k - 1];
	    return new Bezier(np);
	  }

	  derivative(t) {
	    return utils.compute(t, this.dpoints[0]);
	  }

	  dderivative(t) {
	    return utils.compute(t, this.dpoints[1]);
	  }

	  align() {
	    let p = this.points;
	    return new Bezier(utils.align(p, { p1: p[0], p2: p[p.length - 1] }));
	  }

	  curvature(t) {
	    return utils.curvature(t, this.dpoints[0], this.dpoints[1], this._3d);
	  }

	  inflections() {
	    return utils.inflections(this.points);
	  }

	  normal(t) {
	    return this._3d ? this.__normal3(t) : this.__normal2(t);
	  }

	  __normal2(t) {
	    const d = this.derivative(t);
	    const q = sqrt(d.x * d.x + d.y * d.y);
	    return { x: -d.y / q, y: d.x / q };
	  }

	  __normal3(t) {
	    const r1 = this.derivative(t),
	      r2 = this.derivative(t + 0.01),
	      q1 = sqrt(r1.x * r1.x + r1.y * r1.y + r1.z * r1.z),
	      q2 = sqrt(r2.x * r2.x + r2.y * r2.y + r2.z * r2.z);
	    r1.x /= q1;
	    r1.y /= q1;
	    r1.z /= q1;
	    r2.x /= q2;
	    r2.y /= q2;
	    r2.z /= q2;
	    const c = {
	      x: r2.y * r1.z - r2.z * r1.y,
	      y: r2.z * r1.x - r2.x * r1.z,
	      z: r2.x * r1.y - r2.y * r1.x,
	    };
	    const m = sqrt(c.x * c.x + c.y * c.y + c.z * c.z);
	    c.x /= m;
	    c.y /= m;
	    c.z /= m;
	    // rotation matrix
	    const R = [
	      c.x * c.x,
	      c.x * c.y - c.z,
	      c.x * c.z + c.y,
	      c.x * c.y + c.z,
	      c.y * c.y,
	      c.y * c.z - c.x,
	      c.x * c.z - c.y,
	      c.y * c.z + c.x,
	      c.z * c.z,
	    ];
	    // normal vector:
	    const n = {
	      x: R[0] * r1.x + R[1] * r1.y + R[2] * r1.z,
	      y: R[3] * r1.x + R[4] * r1.y + R[5] * r1.z,
	      z: R[6] * r1.x + R[7] * r1.y + R[8] * r1.z,
	    };
	    return n;
	  }

	  hull(t) {
	    let p = this.points,
	      _p = [],
	      q = [],
	      idx = 0;
	    q[idx++] = p[0];
	    q[idx++] = p[1];
	    q[idx++] = p[2];
	    if (this.order === 3) {
	      q[idx++] = p[3];
	    }
	    while (p.length > 1) {
	      _p = [];
	      for (let i = 0, pt, l = p.length - 1; i < l; i++) {
	        pt = utils.lerp(t, p[i], p[i + 1]);
	        q[idx++] = pt;
	        _p.push(pt);
	      }
	      p = _p;
	    }
	    return q;
	  }

	  split(t1, t2) {
	    if (t1 === 0 && !!t2) {
	      return this.split(t2).left;
	    }
	    if (t2 === 1) {
	      return this.split(t1).right;
	    }

	    const q = this.hull(t1);
	    const result = {
	      left:
	        this.order === 2
	          ? new Bezier([q[0], q[3], q[5]])
	          : new Bezier([q[0], q[4], q[7], q[9]]),
	      right:
	        this.order === 2
	          ? new Bezier([q[5], q[4], q[2]])
	          : new Bezier([q[9], q[8], q[6], q[3]]),
	      span: q,
	    };

	    result.left._t1 = utils.map(0, 0, 1, this._t1, this._t2);
	    result.left._t2 = utils.map(t1, 0, 1, this._t1, this._t2);
	    result.right._t1 = utils.map(t1, 0, 1, this._t1, this._t2);
	    result.right._t2 = utils.map(1, 0, 1, this._t1, this._t2);

	    if (!t2) {
	      return result;
	    }

	    t2 = utils.map(t2, t1, 1, 0, 1);
	    return result.right.split(t2).left;
	  }

	  extrema() {
	    const result = {};
	    let roots = [];

	    this.dims.forEach(
	      function (dim) {
	        let mfn = function (v) {
	          return v[dim];
	        };
	        let p = this.dpoints[0].map(mfn);
	        result[dim] = utils.droots(p);
	        if (this.order === 3) {
	          p = this.dpoints[1].map(mfn);
	          result[dim] = result[dim].concat(utils.droots(p));
	        }
	        result[dim] = result[dim].filter(function (t) {
	          return t >= 0 && t <= 1;
	        });
	        roots = roots.concat(result[dim].sort(utils.numberSort));
	      }.bind(this)
	    );

	    result.values = roots.sort(utils.numberSort).filter(function (v, idx) {
	      return roots.indexOf(v) === idx;
	    });

	    return result;
	  }

	  bbox() {
	    const extrema = this.extrema(),
	      result = {};
	    this.dims.forEach(
	      function (d) {
	        result[d] = utils.getminmax(this, d, extrema[d]);
	      }.bind(this)
	    );
	    return result;
	  }

	  overlaps(curve) {
	    const lbbox = this.bbox(),
	      tbbox = curve.bbox();
	    return utils.bboxoverlap(lbbox, tbbox);
	  }

	  offset(t, d) {
	    if (typeof d !== "undefined") {
	      const c = this.get(t),
	        n = this.normal(t);
	      const ret = {
	        c: c,
	        n: n,
	        x: c.x + n.x * d,
	        y: c.y + n.y * d,
	      };
	      if (this._3d) {
	        ret.z = c.z + n.z * d;
	      }
	      return ret;
	    }
	    if (this._linear) {
	      const nv = this.normal(0),
	        coords = this.points.map(function (p) {
	          const ret = {
	            x: p.x + t * nv.x,
	            y: p.y + t * nv.y,
	          };
	          if (p.z && nv.z) {
	            ret.z = p.z + t * nv.z;
	          }
	          return ret;
	        });
	      return [new Bezier(coords)];
	    }
	    return this.reduce().map(function (s) {
	      if (s._linear) {
	        return s.offset(t)[0];
	      }
	      return s.scale(t);
	    });
	  }

	  simple() {
	    if (this.order === 3) {
	      const a1 = utils.angle(this.points[0], this.points[3], this.points[1]);
	      const a2 = utils.angle(this.points[0], this.points[3], this.points[2]);
	      if ((a1 > 0 && a2 < 0) || (a1 < 0 && a2 > 0)) return false;
	    }
	    const n1 = this.normal(0);
	    const n2 = this.normal(1);
	    let s = n1.x * n2.x + n1.y * n2.y;
	    if (this._3d) {
	      s += n1.z * n2.z;
	    }
	    return abs(acos(s)) < pi / 3;
	  }

	  reduce() {
	    let i,
	      t1 = 0,
	      t2 = 0,
	      step = 0.01,
	      segment,
	      pass1 = [],
	      pass2 = [];
	    let extrema = this.extrema().values;
	    if (extrema.indexOf(0) === -1) {
	      extrema = [0].concat(extrema);
	    }
	    if (extrema.indexOf(1) === -1) {
	      extrema.push(1);
	    }

	    for (t1 = extrema[0], i = 1; i < extrema.length; i++) {
	      t2 = extrema[i];
	      segment = this.split(t1, t2);
	      segment._t1 = t1;
	      segment._t2 = t2;
	      pass1.push(segment);
	      t1 = t2;
	    }

	    pass1.forEach(function (p1) {
	      t1 = 0;
	      t2 = 0;
	      while (t2 <= 1) {
	        for (t2 = t1 + step; t2 <= 1 + step; t2 += step) {
	          segment = p1.split(t1, t2);
	          if (!segment.simple()) {
	            t2 -= step;
	            if (abs(t1 - t2) < step) {
	              return [];
	            }
	            segment = p1.split(t1, t2);
	            segment._t1 = utils.map(t1, 0, 1, p1._t1, p1._t2);
	            segment._t2 = utils.map(t2, 0, 1, p1._t1, p1._t2);
	            pass2.push(segment);
	            t1 = t2;
	            break;
	          }
	        }
	      }
	      if (t1 < 1) {
	        segment = p1.split(t1, 1);
	        segment._t1 = utils.map(t1, 0, 1, p1._t1, p1._t2);
	        segment._t2 = p1._t2;
	        pass2.push(segment);
	      }
	    });
	    return pass2;
	  }

	  scale(d) {
	    const order = this.order;
	    let distanceFn = false;
	    if (typeof d === "function") {
	      distanceFn = d;
	    }
	    if (distanceFn && order === 2) {
	      return this.raise().scale(distanceFn);
	    }

	    const clockwise = this.clockwise;
	    const r1 = distanceFn ? distanceFn(0) : d;
	    const r2 = distanceFn ? distanceFn(1) : d;
	    const v = [this.offset(0, 10), this.offset(1, 10)];
	    const points = this.points;
	    const np = [];
	    const o = utils.lli4(v[0], v[0].c, v[1], v[1].c);

	    if (!o) {
	      throw new Error("cannot scale this curve. Try reducing it first.");
	    }

	    [0, 1].forEach(function (t) {
	      const p = (np[t * order] = utils.copy(points[t * order]));
	      p.x += (t ? r2 : r1) * v[t].n.x;
	      p.y += (t ? r2 : r1) * v[t].n.y;
	    });

	    if (!distanceFn) {
	      [0, 1].forEach((t) => {
	        if (order === 2 && !!t) return;
	        const p = np[t * order];
	        const d = this.derivative(t);
	        const p2 = { x: p.x + d.x, y: p.y + d.y };
	        np[t + 1] = utils.lli4(p, p2, o, points[t + 1]);
	      });
	      return new Bezier(np);
	    }

	    [0, 1].forEach(function (t) {
	      if (order === 2 && !!t) return;
	      var p = points[t + 1];
	      var ov = {
	        x: p.x - o.x,
	        y: p.y - o.y,
	      };
	      var rc = distanceFn ? distanceFn((t + 1) / order) : d;
	      if (distanceFn && !clockwise) rc = -rc;
	      var m = sqrt(ov.x * ov.x + ov.y * ov.y);
	      ov.x /= m;
	      ov.y /= m;
	      np[t + 1] = {
	        x: p.x + rc * ov.x,
	        y: p.y + rc * ov.y,
	      };
	    });
	    return new Bezier(np);
	  }

	  outline(d1, d2, d3, d4) {
	    d2 = typeof d2 === "undefined" ? d1 : d2;
	    const reduced = this.reduce(),
	      len = reduced.length,
	      fcurves = [];

	    let bcurves = [],
	      p,
	      alen = 0,
	      tlen = this.length();

	    const graduated = typeof d3 !== "undefined" && typeof d4 !== "undefined";

	    function linearDistanceFunction(s, e, tlen, alen, slen) {
	      return function (v) {
	        const f1 = alen / tlen,
	          f2 = (alen + slen) / tlen,
	          d = e - s;
	        return utils.map(v, 0, 1, s + f1 * d, s + f2 * d);
	      };
	    }

	    reduced.forEach(function (segment) {
	      const slen = segment.length();
	      if (graduated) {
	        fcurves.push(
	          segment.scale(linearDistanceFunction(d1, d3, tlen, alen, slen))
	        );
	        bcurves.push(
	          segment.scale(linearDistanceFunction(-d2, -d4, tlen, alen, slen))
	        );
	      } else {
	        fcurves.push(segment.scale(d1));
	        bcurves.push(segment.scale(-d2));
	      }
	      alen += slen;
	    });

	    bcurves = bcurves
	      .map(function (s) {
	        p = s.points;
	        if (p[3]) {
	          s.points = [p[3], p[2], p[1], p[0]];
	        } else {
	          s.points = [p[2], p[1], p[0]];
	        }
	        return s;
	      })
	      .reverse();

	    const fs = fcurves[0].points[0],
	      fe = fcurves[len - 1].points[fcurves[len - 1].points.length - 1],
	      bs = bcurves[len - 1].points[bcurves[len - 1].points.length - 1],
	      be = bcurves[0].points[0],
	      ls = utils.makeline(bs, fs),
	      le = utils.makeline(fe, be),
	      segments = [ls].concat(fcurves).concat([le]).concat(bcurves);

	    return new PolyBezier(segments);
	  }

	  outlineshapes(d1, d2, curveIntersectionThreshold) {
	    d2 = d2 || d1;
	    const outline = this.outline(d1, d2).curves;
	    const shapes = [];
	    for (let i = 1, len = outline.length; i < len / 2; i++) {
	      const shape = utils.makeshape(
	        outline[i],
	        outline[len - i],
	        curveIntersectionThreshold
	      );
	      shape.startcap.virtual = i > 1;
	      shape.endcap.virtual = i < len / 2 - 1;
	      shapes.push(shape);
	    }
	    return shapes;
	  }

	  intersects(curve, curveIntersectionThreshold) {
	    if (!curve) return this.selfintersects(curveIntersectionThreshold);
	    if (curve.p1 && curve.p2) {
	      return this.lineIntersects(curve);
	    }
	    if (curve instanceof Bezier) {
	      curve = curve.reduce();
	    }
	    return this.curveintersects(
	      this.reduce(),
	      curve,
	      curveIntersectionThreshold
	    );
	  }

	  lineIntersects(line) {
	    const mx = min(line.p1.x, line.p2.x),
	      my = min(line.p1.y, line.p2.y),
	      MX = max(line.p1.x, line.p2.x),
	      MY = max(line.p1.y, line.p2.y);
	    return utils.roots(this.points, line).filter((t) => {
	      var p = this.get(t);
	      return utils.between(p.x, mx, MX) && utils.between(p.y, my, MY);
	    });
	  }

	  selfintersects(curveIntersectionThreshold) {

	    const reduced = this.reduce(),
	      len = reduced.length - 2,
	      results = [];

	    for (let i = 0, result, left, right; i < len; i++) {
	      left = reduced.slice(i, i + 1);
	      right = reduced.slice(i + 2);
	      result = this.curveintersects(left, right, curveIntersectionThreshold);
	      results.push(...result);
	    }
	    return results;
	  }

	  curveintersects(c1, c2, curveIntersectionThreshold) {
	    const pairs = [];
	    c1.forEach(function (l) {
	      c2.forEach(function (r) {
	        if (l.overlaps(r)) {
	          pairs.push({ left: l, right: r });
	        }
	      });
	    });
	    let intersections = [];
	    pairs.forEach(function (pair) {
	      const result = utils.pairiteration(
	        pair.left,
	        pair.right,
	        curveIntersectionThreshold
	      );
	      if (result.length > 0) {
	        intersections = intersections.concat(result);
	      }
	    });
	    return intersections;
	  }

	  arcs(errorThreshold) {
	    errorThreshold = errorThreshold || 0.5;
	    return this._iterate(errorThreshold, []);
	  }

	  _error(pc, np1, s, e) {
	    const q = (e - s) / 4,
	      c1 = this.get(s + q),
	      c2 = this.get(e - q),
	      ref = utils.dist(pc, np1),
	      d1 = utils.dist(pc, c1),
	      d2 = utils.dist(pc, c2);
	    return abs(d1 - ref) + abs(d2 - ref);
	  }

	  _iterate(errorThreshold, circles) {
	    let t_s = 0,
	      t_e = 1,
	      safety;
	    do {
	      safety = 0;

	      t_e = 1;

	      let np1 = this.get(t_s),
	        np2,
	        np3,
	        arc,
	        prev_arc;

	      let curr_good = false,
	        prev_good = false,
	        done;

	      let t_m = t_e,
	        prev_e = 1;

	      do {
	        prev_good = curr_good;
	        prev_arc = arc;
	        t_m = (t_s + t_e) / 2;

	        np2 = this.get(t_m);
	        np3 = this.get(t_e);

	        arc = utils.getccenter(np1, np2, np3);

	        //also save the t values
	        arc.interval = {
	          start: t_s,
	          end: t_e,
	        };

	        let error = this._error(arc, np1, t_s, t_e);
	        curr_good = error <= errorThreshold;

	        done = prev_good && !curr_good;
	        if (!done) prev_e = t_e;

	        if (curr_good) {
	          if (t_e >= 1) {
	            arc.interval.end = prev_e = 1;
	            prev_arc = arc;
	            if (t_e > 1) {
	              let d = {
	                x: arc.x + arc.r * cos(arc.e),
	                y: arc.y + arc.r * sin(arc.e),
	              };
	              arc.e += utils.angle({ x: arc.x, y: arc.y }, d, this.get(1));
	            }
	            break;
	          }
	          t_e = t_e + (t_e - t_s) / 2;
	        } else {
	          t_e = t_m;
	        }
	      } while (!done && safety++ < 100);

	      if (safety >= 100) {
	        break;
	      }


	      prev_arc = prev_arc ? prev_arc : arc;
	      circles.push(prev_arc);
	      t_s = prev_e;
	    } while (t_e < 1);
	    return circles;
	  }
	}


	class CubicBezier {
		constructor (x1, y1, x2, y2) {
			const b = new Bezier(0, 0, x1, y1, x2, y2, 1, 1);
			this.b = b;
		}

		compute (p) {
			return this.b.get(p).y
		}
	}

	const Easing = {
		Linear: {
			None: uid()
		},
		Quadratic: {
			In: uid(),
			Out: uid(),
			InOut: uid()
		},
		Cubic: {
			In: uid(),
			Out: uid(),
			InOut: uid(),
			Bezier: function (...args) {
				return args.concat(Easing.Cubic.Bezier)
			}
		},
		Quartic: {
			In: uid(),
			Out: uid(),
			InOut: uid()
		},
		Quintic: {
			In: uid(),
			Out: uid(),
			InOut: uid()
		},
		Sinusoidal: {
			In: uid(),
			Out: uid(),
			InOut: uid()
		},
		Exponential: {
			In: uid(),
			Out: uid(),
			InOut: uid()
		},
		Circular: {
			In: uid(),
			Out: uid(),
			InOut: uid()
		},
		Elastic: {
			In: uid(),
			Out: uid(),
			InOut: uid()
		},
		Back: {
			In: uid(),
			Out: uid(),
			InOut: uid()
		},
		Bounce: {
			In: uid(),
			Out: uid(),
			InOut: uid()
		}
	};

	const EasingKeys = {};

	Object.keys(Easing).forEach(key => {
		let eobj = EasingKeys[key] = {};
		const orgObj = Easing[key];
		Object.keys(orgObj).forEach(_key => {
			eobj[orgObj[_key]] = _key;
		});
	});

	function getEasingByUid (uid) {
		if (isArray(uid) && uid.pop().name.toLowerCase() == 'bezier') {
			return EasingOrigin.Cubic.Bezier(...uid)
		} else {
			const key = easingFunc(uid);
			return (deepGet(EasingOrigin, key, null) || EasingOrigin.Linear.None)
		}
	}

	function easingFunc (uid) {
		const pKeys = Object.keys(EasingKeys);
		let pi = pKeys.length;
		while (--pi) {
			const pKey = pKeys[pi];
			const pObj = EasingKeys[pKey];
			const nKeys = Object.keys(pObj);
			let ni = nKeys.length;
			while (--ni) {
				const nKey = nKeys[ni];
				const val = pObj[nKey];
				if (uid == nKey) {
					return 	[pKey, val].join('.')
				}
			}
		}
	}

	const EasingOrigin = {
		Linear: {
			None: function (k) {
				return k
			}
		},

		Quadratic: {
			In: function (k) {
				return k * k
			},

			Out: function (k) {
				return k * (2 - k)
			},

			InOut: function (k) {
				if ((k *= 2) < 1) {
					return 0.5 * k * k
				}

				return -0.5 * (--k * (k - 2) - 1)
			}
		},

		Cubic: {
			In: function (k) {
				return k * k * k
			},

			Out: function (k) {
				return --k * k * k + 1
			},

			InOut: function (k) {
				if ((k *= 2) < 1) {
					return 0.5 * k * k * k
				}

				return 0.5 * ((k -= 2) * k * k + 2)
			},

			Bezier: function (x1, y1, x2, y2) {
				const c = new CubicBezier(x1, y1, x2, y2);
				return function (k) {
					return c.compute(k)
				}
			}
		},

		Quartic: {
			In: function (k) {
				return k * k * k * k
			},

			Out: function (k) {
				return 1 - (--k * k * k * k)
			},

			InOut: function (k) {
				if ((k *= 2) < 1) {
					return 0.5 * k * k * k * k
				}

				return -0.5 * ((k -= 2) * k * k * k - 2)
			}
		},

		Quintic: {
			In: function (k) {
				return k * k * k * k * k
			},

			Out: function (k) {
				return --k * k * k * k * k + 1
			},

			InOut: function (k) {
				if ((k *= 2) < 1) {
					return 0.5 * k * k * k * k * k
				}

				return 0.5 * ((k -= 2) * k * k * k * k + 2)
			}
		},

		Sinusoidal: {
			In: function (k) {
				return 1 - Math.cos(k * Math.PI / 2)
			},

			Out: function (k) {
				return Math.sin(k * Math.PI / 2)
			},

			InOut: function (k) {
				return 0.5 * (1 - Math.cos(Math.PI * k))
			}
		},

		Exponential: {
			In: function (k) {
				return k === 0 ? 0 : Math.pow(1024, k - 1)
			},

			Out: function (k) {
				return k === 1 ? 1 : 1 - Math.pow(2, -10 * k)
			},

			InOut: function (k) {
				if (k === 0) {
					return 0
				}

				if (k === 1) {
					return 1
				}

				if ((k *= 2) < 1) {
					return 0.5 * Math.pow(1024, k - 1)
				}

				return 0.5 * (-Math.pow(2, -10 * (k - 1)) + 2)
			}
		},

		Circular: {
			In: function (k) {
				return 1 - Math.sqrt(1 - k * k)
			},

			Out: function (k) {
				return Math.sqrt(1 - (--k * k))
			},

			InOut: function (k) {
				if ((k *= 2) < 1) {
					return -0.5 * (Math.sqrt(1 - k * k) - 1)
				}

				return 0.5 * (Math.sqrt(1 - (k -= 2) * k) + 1)
			}
		},

		Elastic: {
			In: function (k) {
				if (k === 0) {
					return 0
				}

				if (k === 1) {
					return 1
				}

				return -Math.pow(2, 10 * (k - 1)) * Math.sin((k - 1.1) * 5 * Math.PI)
			},

			Out: function (k) {
				if (k === 0) {
					return 0
				}

				if (k === 1) {
					return 1
				}

				return Math.pow(2, -10 * k) * Math.sin((k - 0.1) * 5 * Math.PI) + 1
			},

			InOut: function (k) {
				if (k === 0) {
					return 0
				}

				if (k === 1) {
					return 1
				}

				k *= 2;

				if (k < 1) {
					return -0.5 * Math.pow(2, 10 * (k - 1)) * Math.sin((k - 1.1) * 5 * Math.PI)
				}

				return 0.5 * Math.pow(2, -10 * (k - 1)) * Math.sin((k - 1.1) * 5 * Math.PI) + 1
			}
		},

		Back: {
			In: function (k) {
				var s = 1.70158;

				return k * k * ((s + 1) * k - s)
			},

			Out: function (k) {
				var s = 1.70158;

				return --k * k * ((s + 1) * k + s) + 1
			},

			InOut: function (k) {
				var s = 1.70158 * 1.525;

				if ((k *= 2) < 1) {
					return 0.5 * (k * k * ((s + 1) * k - s))
				}

				return 0.5 * ((k -= 2) * k * ((s + 1) * k + s) + 2)
			}
		},

		Bounce: {
			In: function (k) {
				return 1 - Easing.Bounce.Out(1 - k)
			},

			Out: function (k) {
				if (k < (1 / 2.75)) {
					return 7.5625 * k * k
				} else if (k < (2 / 2.75)) {
					return 7.5625 * (k -= (1.5 / 2.75)) * k + 0.75
				} else if (k < (2.5 / 2.75)) {
					return 7.5625 * (k -= (2.25 / 2.75)) * k + 0.9375
				} else {
					return 7.5625 * (k -= (2.625 / 2.75)) * k + 0.984375
				}
			},

			InOut: function (k) {
				if (k < 0.5) {
					return Easing.Bounce.In(k * 2) * 0.5
				}

				return Easing.Bounce.Out(k * 2 - 1) * 0.5 + 0.5
			}
		}
	};

	/**
	 * Ensure a function is called only once.
	 * @param  {Function} fn [description]
	 * @return {[type]}      [description]
	 */
	function once (fn) {
		var called = false;
		return function () {
			if (!called) {
				called = true;
				fn.apply(this, arguments);
			}
		}
	}

	class MoveTo {
		constructor (x, y, time, easing = Easing.Linear.None, isReverse = false) {
			this.time = time;
			this.easing = getEasingByUid(easing);
			this.x = x;
			this.y = y;

			this.reset();
			this.onlyReverseCb = once(this.recordBasePosition.bind(this));
		}

		recordBasePosition (sprite) {
			this.baseX = sprite.x;
			this.baseY = sprite.y;
			this.countDistanceX = this.x - this.baseX;
			this.countDistanceY = this.y - this.baseY;
		}

		reset () {
			this._time = this.time;
		}

		update (sprite, delta) {
			this.onlyReverseCb(sprite);

			this._time -= delta;
			// const percent = Easing.Quadratic.In(1 - this._time / this.time)
			const percent = this.easing(1 - this._time / this.time);
			sprite.x = this.baseX + this.countDistanceX * percent;
			sprite.y = this.baseY + this.countDistanceY * percent;

			if (this._time <= 0) {
				sprite.x = this.x;
				sprite.y = this.y;
				this.reset();
				return true
			}

			return false
		}
	}

	class MoveBy {
		constructor (x, y, time, easing = Easing.Linear.None) {
			this.time = time;
			this._easing = easing;
			this.easing = getEasingByUid(easing);
			this.x = x;
			this.y = y;

			this.reset();
			this.onlyReverseCb = once(this.recordBasePosition.bind(this));
		}

		reverse () {
			return new MoveBy(-this.x, -this.y, this.time, this._easing)
		}

		recordBasePosition (sprite) {
			this.baseX = sprite.x;
			this.baseY = sprite.y;
		}

		reset () {
			this._time = this.time;
		}

		update (sprite, delta) {
			this.onlyReverseCb(sprite);

			this._time -= delta;
			const percent = this.easing(1 - this._time / this.time);
			sprite.x = this.baseX + this.x * percent;
			sprite.y = this.baseY + this.y * percent;

			if (this._time <= 0) {
				sprite.x = this.x + this.baseX;
				sprite.y = this.y + this.baseY;
				this.reset();
				return true
			}

			return false
		}
	}

	var move = {
		__proto__: null,
		MoveTo: MoveTo,
		MoveBy: MoveBy
	};

	class Sequence {
		constructor (actions) {
			this.actions = actions;

			this.reset();
		}

		reset () {
			this._index = 0;
		}

		update (sprite, delta) {
			if (this._index >= this.actions.length) {
				return true
			}

			const action = this.actions[this._index];
			const isEnd = action.update(sprite, delta);
			if (isEnd) {
				action.reset();
				this._index += 1;
			}

			return false
		}
	}

	var sequence = {
		__proto__: null,
		Sequence: Sequence
	};

	class Delay {
		constructor (time) {
			this.time = time;
			this.reset();
		}

		reset () {
			this._time = this.time;
		}

		update(sprite, delta) {
			this._time -= delta;
			if (this._time <= 0) {
				this.reset();
				return true
			}

			return false
		}
	}

	var delay = {
		__proto__: null,
		Delay: Delay
	};

	class RotateTo {
		constructor (rotation, time, easing = Easing.Linear.None) {
			this.time = time;
			this.easing = getEasingByUid(easing);
			this.rotation = rotation * PI_2;

			this.onlyReverseCb = once(this.recordBasePosition.bind(this));

			this.reset();
		}

		recordBasePosition (sprite) {
			this.baseRotation = sprite.rotation;
			this.countDistanceRotation = this.rotation - this.baseRotation;
		}

		reset () {
			this._time = this.time;
		}

		update (sprite, delta) {
			this.onlyReverseCb(sprite);

			this._time -= delta;
			const percent = this.easing(1 - this._time / this.time);
			sprite.rotation = this.baseRotation + this.countDistanceRotation * percent;

			if (this._time <= 0) {
				sprite.rotation = this.baseRotation + this.countDistanceRotation;
				this.reset();
				return true
			}

			return false
		}
	}

	class RotateBy {
		constructor (rotation, time, easing = Easing.Linear.None) {
			this.time = time;
			this._easing = easing;
			this.easing = getEasingByUid(easing);
			this.rotation = rotation * PI_2;

			this.onlyReverseCb = once(this.recordBasePosition.bind(this));

			this.reset();
		}

		reverse () {
			return new RotateBy(-this.rotation / PI_2, this.time, this._easing)
		}

		recordBasePosition (sprite) {
			this.baseRotation = sprite.rotation;
		}

		reset () {
			this._time = this.time;
		}

		update (sprite, delta) {
			this.onlyReverseCb(sprite);

			this._time -= delta;
			const percent = this.easing(1 - this._time / this.time);
			sprite.rotation = this.baseRotation + this.rotation * percent;

			if (this._time <= 0) {
				sprite.rotation = this.baseRotation + this.rotation;
				this.reset();
				return true
			}

			return false
		}
	}

	var rotation = {
		__proto__: null,
		RotateTo: RotateTo,
		RotateBy: RotateBy
	};

	class Spawn {
		constructor (actions) {
			this.actions = actions;
			this.__actions = [];

		}

		reset () {
			this.actions = this.__actions;
		}

		update (sprite, delta) {
			if (!this.actions || !this.actions.length) {
				return true
			}

			let result = true;
			for (let i = this.actions.length - 1; i >= 0; i--) {
				const action = this.actions[i];

				const isEnd = action.update(sprite, delta);
				if (isEnd) {
					action.reset();
					this.actions.splice(i, 1);
					this.__actions.push(action);
				} else {
					result = false;
				}
			}

			return result
		}
	}

	var SpawnTemp = {
		__proto__: null,
		Spawn: Spawn
	};

	class CallFunc {
		constructor (func) {
			this.func = func || Function.prototype;

			this.reset();
		}

		reset () {
		}

		update (sprite, delta) {
			this.func();
			this.reset();
			return true
		}
	}

	var callFunc = {
		__proto__: null,
		CallFunc: CallFunc
	};

	class ScaleTo {
		constructor (scaleX, scaleY, time, easing = Easing.Linear.None) {
			this.time = time;
			this.easing = getEasingByUid(easing);
			this.x = scaleX;
			this.y = scaleY;

			this.onlyReverseCb = once(this.recordBasePosition.bind(this));

			this.reset();
		}

		recordBasePosition (sprite) {
			this.baseScaleX = sprite.scale.x;
			this.baseScaleY = sprite.scale.y;
			this.countDistanceScaleX = this.x - this.baseScaleX;
			this.countDistanceScaleY = this.x - this.baseScaleY;
		}

		reset () {
			this._time = this.time;
		}

		update (sprite, delta) {
			this.onlyReverseCb(sprite);

			this._time -= delta;
			const percent = this.easing(1 - this._time / this.time);
			sprite.scale.x = this.baseScaleX + this.countDistanceScaleX * percent;
			sprite.scale.y = this.baseScaleY + this.countDistanceScaleY * percent;

			if (this._time <= 0) {
				sprite.scale.x = this.baseScaleX + this.countDistanceScaleX;
				sprite.scale.y = this.baseScaleY + this.countDistanceScaleY;

				this.reset();
				return true
			}

			return false
		}
	}

	class ScaleBy {
		constructor (scaleX, scaleY, time, easing = Easing.Linear.None) {
			this.time = time;
			this._easing = easing;
			this.easing = getEasingByUid(easing);
			this.x = scaleX;
			this.y = scaleY;

			this.onlyReverseCb = once(this.recordBasePosition.bind(this));

			this.reset();
		}

		recordBasePosition (sprite) {
			this.baseScaleX = sprite.scale.x;
			this.baseScaleY = sprite.scale.y;
			this.countDistanceScaleX = this.x;
			this.countDistanceScaleY = this.x;
		}

		reverse () {
			return new ScaleBy(-this.x, -this.y, this.time, this._easing)
		}

		reset () {
			this._time = this.time;
		}

		update (sprite, delta) {
			this.onlyReverseCb(sprite);

			this._time -= delta;
			const percent = this.easing(1 - this._time / this.time);
			sprite.scale.x = this.baseScaleX + this.countDistanceScaleX * percent;
			sprite.scale.y = this.baseScaleY + this.countDistanceScaleY * percent;

			if (this._time <= 0) {
				sprite.scale.x = this.baseScaleX + this.countDistanceScaleX;
				sprite.scale.y = this.baseScaleY + this.countDistanceScaleY;

				this.reset();
				return true
			}

			return false
		}
	}

	var scale = {
		__proto__: null,
		ScaleTo: ScaleTo,
		ScaleBy: ScaleBy
	};

	class FadeIn {
		constructor (time, easing = Easing.Linear.None) {
			this.time = time;
			this._easing = easing;
			this.easing = getEasingByUid(easing);

			this.onlyReverseCb = once(this.recordBasePosition.bind(this));

			this.reset();
		}

		reverse () {
			return new FadeOut(this.time, this._easing)
		}

		recordBasePosition (sprite) {
			this.baseAlpha = sprite.alpha;
		}

		reset () {
			this._time = this.time;
		}

		update (sprite, delta) {
			this.onlyReverseCb(sprite);

			this._time -= delta;
			const percent = this.easing(1 - this._time / this.time);
			sprite.alpha = percent;

			if (this._time <= 0) {
				sprite.alpha = 1;
				this.reset();
				return true
			}

			return false
		}
	}

	class FadeOut {
		constructor (time, easing = Easing.Linear.None) {
			this.time = time;
			this._easing = easing;
			this.easing = getEasingByUid(easing);

			this.onlyReverseCb = once(this.recordBasePosition.bind(this));

			this.reset();
		}

		reverse () {
			return new FadeIn(this.time, this._easing)
		}

		recordBasePosition (sprite) {
			this.baseAlpha = sprite.alpha;
		}

		reset () {
			this._time = this.time;
		}

		update (sprite, delta) {
			this.onlyReverseCb(sprite);

			this._time -= delta;
			const percent = this.easing(1 - this._time / this.time);
			sprite.alpha = 1 - percent;

			if (this._time <= 0) {
				sprite.alpha = 0;
				this.reset();
				return true
			}

			return false
		}
	}

	var fade = {
		__proto__: null,
		FadeIn: FadeIn,
		FadeOut: FadeOut
	};

	class AlphaTo {
		constructor (alpha, time, easing = Easing.Linear.None) {
			this.time = time;
			this.easing = getEasingByUid(easing);
			this.alpha = alpha;

			this.onlyReverseCb = once(this.recordBasePosition.bind(this));

			this.reset();
		}

		recordBasePosition (sprite) {
			this.baseAlpha = sprite.alpha;
			this.countDistanceAlpha = this.alpha - sprite.alpha;
		}

		reset () {
			this._time = this.time;
		}

		update (sprite, delta) {
			this.onlyReverseCb(sprite);

			this._time -= delta;
			const percent = this.easing(1 - this._time / this.time);
			sprite.alpha = this.baseAlpha + this.countDistanceAlpha * percent;

			if (this._time <= 0) {
				sprite.alpha = this.baseAlpha + this.countDistanceAlpha;
				this.reset();
				return true
			}

			return false
		}
	}

	class AlphaBy {
		constructor (alpha, time, easing = Easing.Linear.None) {
			this.time = time;
			this._easing = easing;
			this.easing = getEasingByUid(easing);
			this.alpha = alpha;

			this.onlyReverseCb = once(this.recordBasePosition.bind(this));

			this.reset();
		}

		reverse () {
			return new AlphaBy(-this.alpha, this.time, this._easing)
		}

		recordBasePosition (sprite) {
			this.baseAlpha = sprite.alpha;
			this.countDistanceAlpha = this.alpha;
		}

		reset () {
			this._time = this.time;
		}

		update (sprite, delta) {
			this.onlyReverseCb(sprite);

			this._time -= delta;
			const percent = this.easing(1 - this._time / this.time);
			sprite.alpha = this.baseAlpha + this.countDistanceAlpha * percent;

			if (this._time <= 0) {
				sprite.alpha = this.baseAlpha + this.countDistanceAlpha;
				this.reset();
				return true
			}

			return false
		}
	}

	var alpha = {
		__proto__: null,
		AlphaTo: AlphaTo,
		AlphaBy: AlphaBy
	};

	class Repeat {
		constructor (action, count) {
			this.action = action;
			this.count = count;

			this.reset();
		}

		reset () {
			this._count = this.count;
			if (!this._count) this._count = Infinity;
		}

		update (sprite, delta) {
			const isEnd = this.action.update(sprite, delta);
			if (isEnd) {
				this.action.reset();
				this._count--;
			}

			if (this._count <= 0) {
				this.reset();
				return true
			}
			return false
		}
	}

	var repeat = {
		__proto__: null,
		Repeat: Repeat
	};

	class Blink {
		constructor (count, time) {
			this.count = count;
			this.time = time;

			this.reset();
		}

		reset () {
			this._time = this.time;
			this._count = this.count * 2;
			this._gap = this.time / this._count;

			if (this._gap < 16.6) {
				this._gap = 17;
				this._count = parseInt(this.time / this._gap);
			}

			this._timer = 0;
		}

		update (sprite, delta) {
			this._time -= delta;
			if (this._timer <= 0) {
				sprite.visible = !sprite.visible;
				this._timer = this._gap;
				this._count--;
			} else {
				this._timer -= delta;
			}

			if (this._count <= 0 || this._time <= 0) {
				if (this._count % 2 > 0) {
					sprite.visible = !sprite.visible;
				}
				this.reset();
				return true
			}
			return false
		}
	}

	var blink = {
		__proto__: null,
		Blink: Blink
	};

	class SkewTo {
		constructor (x, y, time, easing = Easing.Linear.None) {
			this.time = time;
			this.easing = getEasingByUid(easing);
			this.x = x * PI_2;
			this.y = y * PI_2;

			this.reset();
			this.onlyReverseCb = once(this.recordBasePosition.bind(this));
		}

		recordBasePosition (sprite) {
			this.baseSkewX = sprite.skew.x;
			this.baseSkewY = sprite.skew.y;
			this.countDistanceSkewX = this.x - this.baseSkewX;
			this.countDistanceSkewY = this.y - this.baseSkewY;
		}

		reset () {
			this._time = this.time;
		}

		update (sprite, delta) {
			this.onlyReverseCb(sprite);

			this._time -= delta;
			const percent = this.easing(1 - this._time / this.time);
			sprite.skew.x = this.baseSkewX + this.countDistanceSkewX * percent;
			sprite.skew.y = this.baseSkewY + this.countDistanceSkewY * percent;

			if (this._time <= 0) {
				sprite.skew.x = this.x;
				sprite.skew.y = this.y;
				this.reset();
				return true
			}

			return false
		}
	}

	class SkewBy {
		constructor (x, y, time, easing = Easing.Linear.None) {
			this.time = time;
			this._easing = easing;
			this.easing = getEasingByUid(easing);
			this.x = x * PI_2;
			this.y = y * PI_2;

			this.reset();
			this.onlyReverseCb = once(this.recordBasePosition.bind(this));
		}

		reverse () {
			return new SkewBy(-this.x / PI_2, -this.y / PI_2, this.time, this._easing)
		}

		recordBasePosition (sprite) {
			this.baseSkewX = sprite.skew.x;
			this.baseSkewY = sprite.skew.y;
			this.countDistanceSkewX = this.x;
			this.countDistanceSkewY = this.y;
		}

		reset () {
			this._time = this.time;
		}

		update (sprite, delta) {
			this.onlyReverseCb(sprite);

			this._time -= delta;
			const percent = this.easing(1 - this._time / this.time);
			sprite.skew.x = this.baseSkewX + this.countDistanceSkewX * percent;
			sprite.skew.y = this.baseSkewY + this.countDistanceSkewY * percent;

			if (this._time <= 0) {
				sprite.skew.x = this.baseSkewX + this.countDistanceSkewX;
				sprite.skew.y = this.baseSkewY + this.countDistanceSkewY;
				this.reset();
				return true
			}

			return false
		}
	}

	var skew = {
		__proto__: null,
		SkewTo: SkewTo,
		SkewBy: SkewBy
	};

	const action = {
		...move,
		...sequence,
		...delay,
		...rotation,
		...SpawnTemp,
		...callFunc,
		...scale,
		...fade,
		...alpha,
		...repeat,
		...blink,
		...skew,
	};
	const actionManager = new ActionManager();

	/**
	 * [
	 * {Stop: 0, color: 'red'},
	 * {Stop: 0.25, color: 'green'},
	 * {Stop: 0.5, color: 'blue'},
	 * {Stop: 0.75, color: 'black'}
	 * {Stop: 1, color: 'white'}
	 * ]
	 * @param  {[type]} arr [description]
	 * @return {[type]}     [description]
	 */
	const linearGradient = (arg, stops) => {
		return () => [arg, stops]
	};

	const RED = '#f00';
	const YELLOW = '#0f0';
	const BLUE = '#00f';
	const WHEAT = '#f5deb3';
	const WHITE = '#fff';
	const BLACK = '#000';

	var _colors = {
		__proto__: null,
		RED: RED,
		YELLOW: YELLOW,
		BLUE: BLUE,
		WHEAT: WHEAT,
		WHITE: WHITE,
		BLACK: BLACK
	};

	const colors = {};

	Object.keys(_colors).forEach(key => {
		const _ = _colors[key];
		colors[key.toUpperCase()] = _;
		colors[key.toLowerCase()] = _;
	});

	const color = {
		...colors,
		linearGradient
	};

	const noop = Function.prototype;

	class Tick {
		constructor (fn, context) {
			this.fn = typeof fn === 'function' ? fn : noop;
			this.context = context;
			this.isDestroyed = false;
		}

		match (fn, context) {
			return this.fn === fn && this.context === context
		}

		run () {
			this.fn.apply(this.context, [].slice.call(arguments));

			return this
		}

		destroy () {
			this.isDestroyed = true;
			this.fn = null;
			this.context = null;
			this.destroyEmitParentCallback && this.destroyEmitParentCallback();
		}
	}

	class ScheduleItem {
		static create (fn, gap, context) {
			const item = new ScheduleItem(fn, gap, context);
			return item
		}

		constructor (fn, gap, context) {
			const tick = new Tick(fn, context);
			this.tick = tick;
			this.gap = gap;
			this.__gap = this.gap;
		}

		restart () {
			this.__currentTime = null;
		}

		update () {
			if (!this.__currentTime) {
				this.__currentTime = now();
			}

			const leftTime = now() - this.__currentTime;

			this.__gap -= leftTime;
			if (this.__gap <= 0) {
				this.tick.run();
				this.__gap = this.gap;
			}

			this.__currentTime = now();
		}
	}

	class Scheduler {
		constructor () {
			this.version = '1.0.0';
			this.ticks = [];
		}

		add (fn, gap = 16.67, context) {
			const item = ScheduleItem.create(fn, gap, context);
			this.ticks.push(item);

			return () => {
				remove(this.ticks, item);
			}
		}

		addOnce (fn, gap = 16.67, context) {
			const destroyCallFun = () => {
				if (isObject(context)) {
					fn = fn.bind(context);
				}

				fn();
				remove(this.ticks, item);
			};
			const item = ScheduleItem.create(destroyCallFun, gap, context);
			this.ticks.push(item);

			return () => {
				remove(this.ticks, item);
			}
		}

		start () {
			if (this._start) return
			this._start = true;
			this.ticks.forEach(tick => tick.restart());
		}

		update () {
			if (!this._start) return

			this.ticks.forEach(tick => tick.update());
		}

		stop () {
			this._start = false;
		}
	}

	const REG_REGBA = /^\s*rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)\s*$/;
	const REG_REGB = /^\s*rgb\((?:(\s*\d+\s*),)(?:(\s*\d+\s*),)(?:(\s*\d+\s*))\)$/;
	function rgba2json(rgba) {
	    const res = rgba.match(REG_REGBA);
	    if (res) {
	        return {
	            r: +res[1],
	            g: +res[2],
	            b: +res[3],
	            a: +res[4]
	        };
	    }
	}
	function rgb2hex(str, pre) {
	    let _ = str.trim();
	    if (!REG_REGB.test(_)) {
	        return '';
	    }
	    const res = _.match(REG_REGB);
	    if (!res) {
	        throw new Error("[Error Tu:]" + str + " is not match");
	    }
	    const r = res[1];
	    const g = res[2];
	    const b = res[3];
	    let hexr = parseInt(r).toString(16);
	    hexr = hexr.length > 1 ? hexr : '0' + hexr;
	    let hexg = parseInt(g).toString(16);
	    hexg = hexg.length > 1 ? hexg : '0' + hexg;
	    let hexb = parseInt(b).toString(16);
	    hexb = hexb.length > 1 ? hexb : '0' + hexb;
	    let prefix;
	    if (['0x', '#'].indexOf(pre) > -1) {
	        prefix = pre;
	    }
	    else {
	        prefix = '0x';
	    }
	    return `${prefix}${hexr}${hexg}${hexb}`;
	}
	function hex2rgb(str) {
	    let _ = '';
	    if (/^#/.test(str)) {
	        _ = str.slice(1);
	    }
	    else if (/^0x/.test(str)) {
	        _ = str.slice(2);
	    }
	    if (!(_.length == 3 || _.length == 6))
	        return '';
	    let r, g, b;
	    switch (_.length) {
	        case 3:
	            r = _.substr(0, 1);
	            g = _.substr(1, 1);
	            b = _.substr(2, 1);
	            r = parseInt(`0x${r}${r}`);
	            g = parseInt(`0x${g}${g}`);
	            b = parseInt(`0x${b}${b}`);
	            break;
	        case 6:
	            r = _.substr(0, 2);
	            g = _.substr(2, 2);
	            b = _.substr(4, 2);
	            r = parseInt('0x' + r);
	            g = parseInt('0x' + g);
	            b = parseInt('0x' + b);
	            break;
	    }
	    return `rgb(${r}, ${g}, ${b})`;
	}
	function rgb2hsl(r, g, b) {
	    let R = r / 255;
	    let G = g / 255;
	    let B = b / 255;
	    const cmax = maxArr([R, G, B]);
	    const cmin = minArr([R, G, B]);
	    const c = cmax - cmin;
	    let L;
	    let S;
	    let H;
	    L = (cmax + cmin) / 2;
	    S = c / (1 - Math.abs(2 * L - 1));
	    if (R == cmax) {
	        H = (G - B) / (cmax - cmin);
	    }
	    else if (G == cmax) {
	        H = 2 + (B - R) / (cmax - cmin);
	    }
	    else if (B == cmax) {
	        H = 4 + (R - G) / (cmax - cmin);
	    }
	    else {
	        throw new Error("[Error Tu:]" + r + g + b + " is not match");
	    }
	    H *= 60;
	    H = H < 0 ? 360 : H;
	    return `hsl(${H}, ${S}, ${L})`;
	}

	function width (target, width) {
		const ratio = target.width / target.height;
		target.width = width;
		target.height = width / ratio;
		return target
	}

	function height (target, height) {
		const ratio = target.width / target.height;
		target.height = height;
		target.width = height * ratio;
		return target
	}

	var index = {
		__proto__: null,
		width: width,
		height: height,
		deepGet: deepGet,
		rgba2json: rgba2json,
		rgb2hex: rgb2hex,
		hex2rgb: hex2rgb,
		rgb2hsl: rgb2hsl
	};

	const scheduler = new Scheduler();

	exports.Container = DisplayObjectContainer;
	exports.Easing = Easing;
	exports.EasingKeys = EasingKeys;
	exports.Loader = Loader;
	exports.Rect = Rect;
	exports.Renderer = Renderer;
	exports.Sprite = Sprite;
	exports.Text = Text;
	exports.action = action;
	exports.actionManager = actionManager;
	exports.color = color;
	exports.scheduler = scheduler;
	exports.utils = index;
})))
