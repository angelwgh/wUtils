/**
 * myVue 1.0.0
 */

!(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.myVue = factory());
})(this, (function () {

	/**
	 * 带有一些特定方法的空对象
	 */
	var _Set = (function () {
	    function Set () {
	      this.set = Object.create(null);
	    }
	    Set.prototype.has = function has (key) {
	      return this.set[key] === true
	    };
	    Set.prototype.add = function add (key) {
	      this.set[key] = true;
	    };
	    Set.prototype.clear = function clear () {
	      this.set = Object.create(null);
	    };

	    return Set;
 	 }());

	console.log(new _Set())
	/**
	 * 删除数组中的一个元素
	 */
	function remove (arr, item) {
	  if (arr.length) {
	    var index = arr.indexOf(item);
	    if (index > -1) {
	      return arr.splice(index, 1)
	    }
	  }
	}

	/**
	 * 观察者
	 */
	function Observer(data) {
		this.data = data;

		this.walk(data);
	}

	// 遍历data的属性， 逐个观察
	Observer.prototype.walk = function(data){
		
		var keys = Object.keys(data);
		for (var i = 0; i < keys.length; i++) {
		    this.defineReactive(data, keys[i], data[keys[i]]);
		}
	};

	// 监听对象的属性
	Observer.prototype.defineReactive = function(data, key, value){
		// 一个闭包，每个属性的订阅者各自独立
		var dep = new Dep()
		// 监听子属性
		var childObj = observer(value)

		Object.defineProperty(data, key, {
			enumerable: true,
    		configurable: true,
    		get: function () {
    			if (Dep.target){
    				// 添加订阅者
    				dep.depend();
    			}
    			return value;
    		},

    		set: function (newValue) {
    			if (newValue === value){
    				return
    			}
    			value = newValue;
    			// 新的值是object的话，进行监听
                childObj = observer(newValue);
                // 通知订阅者
                dep.notify();
    		}
		})
		
	};


	//新建一个观察者对象
	function observer(data) {
		if (!data || typeof data !== 'object') {
	        return;
	    }

	    return new Observer(data)
	}


	/**
	 * 一个消息订阅器，维护一个数组，用来收集订阅者，数据变动触发notify，再调用订阅者的update方法
	 */
	
	var depId = 0

	function Dep() {
		this.id = depId++
		this.subs = [];
	}

	// 添加订阅者
	Dep.prototype.addSub = function (sub) {
		this.subs.push(sub)
	};

	// 添加watcher
	Dep.prototype.depend = function(){

		if(Dep.target){
			Dep.target.addDep(this);
		}
	};

	// 删除订阅者
	Dep.prototype.removeSub = function removeSub (sub) {
	  remove(this.subs, sub);
	};

	// 通知订阅者， 触发订阅事件
	Dep.prototype.notify = function notify () {
	  
	  var subs = this.subs.slice();
	  for (var i = 0, l = subs.length; i < l; i++) {
	    subs[i].update();
	  }
	};

	/**
	 * 实现Compile
	 *
	 * compile主要做的事情是解析模板指令，将模板中的变量替换成数据，然后初始化渲染页面视图，
	 * 并将每个指令对应的节点绑定更新函数，添加监听数据的订阅者，一旦数据有变动，收到通知，更新视图
	 */
	
	function Compile(el, vm) {
	    this.$vm = vm;
	    this.$el = this.isElementNode(el) ? el : document.querySelector(el);

	    if (this.$el) {
	        this.$fragment = this.node2Fragment(this.$el);
	        this.init();
	        this.$el.appendChild(this.$fragment);
	    }
	}

	Compile.prototype = {
		node2Fragment: function (el) {
			var fragment = document.createDocumentFragment(),
				child;
				// 将源生节点拷贝到fragment
			while (child = el.firstChild){
				fragment.appendChild(child);
			}

			return 	fragment;
		},
		init: function () {
			this.compileElement(this.$fragment);
		},

		// 遍历所有节点及其子节点，进行扫描解析编译，
		// 调用对应的指令渲染函数进行数据渲染，并调用对应的指令更新函数进行绑定

		compileElement: function (el) {
			var childNodes = [].slice.call(el.childNodes), 
				self = this,
				node;


				for(var i = 0; i<childNodes.length; i++){
					node = childNodes[i];

					var text = node.textContent;
					var reg = /\{\{(.*)\}\}/;	// 表达式文本 如：{{title}}

					// 编译元素节点
					if(self.isElementNode(node)){
						self.compile(node)
					// 编译文本节点
					}else if (self.isTextNode(node) && reg.test(text)) {
						// console.dir(reg)
						self.compileText(node)
					}

					// // 遍历编译子节点
					if(node.childNodes && node.childNodes.length){
						self.compileElement(node)
					}
				}
		},

		// 解析元素节点
		compile: function (node) {
			var nodeAttrs = [].slice.call(node.attributes),
			self = this,
			attr,attName;
			// 遍历元素的属性
			for(var i = 0; i<nodeAttrs.length; i++){
				attr = nodeAttrs[i];

				// 规定：指令以 v-xxx 命名
	        	// 如 <span v-text="content"></span> 中指令为 v-text
	        	attrName = attr.name;	// 获取属性名，
	        	if(self.isDirective(attrName)){
	        		var exp = attr.value; // 属性内容
                	var dir = attrName.replace(/^v-/,''); // 指令名称
                	// 事件指令 v-on:click
	                if (self.isEventDirective(dir)) {
	                    compileUtil.eventHandler(node, self.$vm, exp, dir);
	                    // 普通指令 v-test
	                } else {
	                    compileUtil[dir] && compileUtil[dir](node, self.$vm, exp);
	                }

	                node.removeAttribute(attrName); //移除指令属性
	        	}
			}
		},

		// 解析文本节点
		compileText: function(node) {
			parserTextContent.add(node)
			// .bindText(node, this.$vm)
			var reg = /\{\{(.*?)\}\}/g,
				text = node.textContent,
				exp;
				while(exp = reg.exec(text)){
					exp = exp[1];
					// compileUtil.text(node, this.$vm, exp);
					parserTextContent.bindText(node, this.$vm, exp)
				}
			console.log(parserTextContent)
			// console.log(parserTextContent)
			// console.log(text)
			// var exp = text
	        
	    },

		// 元素节点
		isElementNode: function (node) {
			return node.nodeType == 1;
		},

		// 文本节点
		isTextNode: function(node) {
	        return node.nodeType == 3;
	    },
	    // 指令
	    isDirective: function(attr) {
	        return attr.indexOf('v-') == 0;
	    },

	    // 事件指令
	    isEventDirective: function(dir) {
	        return dir.indexOf('on') === 0;
	    },
	}

	var compileUtil = {

		

		bind: function (node, vm, exp, dir) {
			var updaterFn = updater[dir + 'Updater'];
			// var text = node.textContent
			// console.log(exp)
			updaterFn && updaterFn(node, this._getVMVal(vm, exp));

			new Watcher(vm, exp, function(value, oldValue) {
	            updaterFn && updaterFn(node, value, oldValue);
	        });
		},

		text: function (node, vm, exp) {
			this.bind(node, vm, exp, 'text')
		},

		html: function (node, vm, exp) {
			this.bind(node, vm, exp, 'html')
		},

		model: function(node, vm, exp) {
	        this.bind(node, vm, exp, 'model');

	        var self = this,
	            val = this._getVMVal(vm, exp);
	        node.addEventListener('input', function(e) {
	            var newValue = e.target.value;
	            if (val === newValue) {
	                return;
	            }

	            self._setVMVal(vm, exp, newValue);
	            val = newValue;
	        });
	    },

		_getVMVal: function(vm, exp) {
	        var val = vm;
	        exp = exp.split('.');
	        exp.forEach(function(k) {
	            val = val[k];
	        });
	        return val;
	    },
	    _setVMVal: function (vm, exp, newValue) {
	    	var val = vm;
	        exp = exp.split('.');
	        exp.forEach(function(k, i) {
	            // 非最后一个key，更新val的值
	            if (i < exp.length - 1) {
	                val = val[k];
	            } else {
	                val[k] = newValue;
	            }
	        });
	    }
	}
	

	var updater = {
		textUpdater: function(node, value, o, text) {
			// // console.log(node)
			// console.log(text)
	        node.textContent = typeof value == 'undefined' ? '' : value;

	    },
	    htmlUpdater: function(node, value) {
            node.innerHTML = typeof value == 'undefined' ? '' : value;
        },

        classUpdater: function(node, value, oldValue) {
            var className = node.className;
            className = className.replace(oldValue, '').replace(/\s$/, '');

            var space = className && String(value) ? ' ' : '';

            node.className = className + space + value;
        },

        modelUpdater: function(node, value, oldValue) {
            node.value = typeof value == 'undefined' ? '' : value;
        }
	}

	// 解析{{}}模版
	function ParserTextContent() {
		// 用一个数组存储页面中的字符串模版的相关数据
		this.list = [];
		this.node = null;
	}

	ParserTextContent.prototype = {
		_getObj:function (node) {
			var obj,i = 0,
				list = this.list,
				len = list.length;

			for(; i < len; i++){
				if(node === list[i].node){
					obj = list[i]
					break;
				}
				// console.log(node === list[i].node)
			}

			return obj;
		},
		add: function (node) {

			var obj =  {
				node:node,
				template:node.textContent,
				values:{}
			}

			this.list.push(obj)
			return this;
		},

		remove: function (node) {
			remove(this.list, this._getObj(node))
		},

		bindText: function (node, vm, exp) {
			var self = this
			this.updateText(node,compileUtil._getVMVal(vm, exp),exp)
			new Watcher(vm, exp, function(value, oldValue) {
	            self.updateText(node, value, exp);
	        });
		},

		updateText: function (node, value, exp) {
			var list = this.list,
				len = list.length,
				i = 0,
				obj = this._getObj(node),
				key, text='';

			obj.values[exp] = {
				exp: '{{' + exp + '}}',
				value: value
			}
			text = obj.template
			for (key in obj.values){
				text = text.replace(obj.values[key].exp, obj.values[key].value)
			}

			node.textContent = text;

			console.log(obj)
		},

	};

	var parserTextContent = new ParserTextContent();


	/**
	 * 实现watcher
 	*/
 
 	function Watcher(vm, expOrFn, cb) {
 		this.cb = cb;
 		this.vm = vm;
 		this.expOrFn = expOrFn;

 		this.depIds = {};

 		// 用来触发属性的getter， 从而在dep中添加自身
 		// console.log(expOrFn)
 		if(typeof expOrFn === 'function'){
 			this.getter = expOrFn;
 		}else{
 			this.getter = this.parseGetter(expOrFn);
 		};

 		// console.log(this.getter)
 		this.value = this.get();
 	}

 	// 1. 每次调用run()的时候会触发相应属性的getter
    // getter里面会触发dep.depend()，继而触发这里的addDep
    // 2. 假如相应属性的dep.id已经在当前watcher的depIds里，说明不是一个新的属性，仅仅是改变了其值而已
    // 则不需要将当前watcher添加到该属性的dep里
    // 3. 假如相应属性是新的属性，则将当前watcher添加到新属性的dep里
    // 如通过 vm.child = {name: 'a'} 改变了 child.name 的值，child.name 就是个新属性
    // 则需要将当前watcher(child.name)加入到新的 child.name 的dep里
    // 因为此时 child.name 是个新值，之前的 setter、dep 都已经失效，如果不把 watcher 加入到新的 child.name 的dep中
    // 通过 child.name = xxx 赋值的时候，对应的 watcher 就收不到通知，等于失效了
    // 4. 每个子属性的watcher在添加到子属性的dep的同时，也会添加到父属性的dep
    // 监听子属性的同时监听父属性的变更，这样，父属性改变时，子属性的watcher也能收到通知进行update
    // 这一步是在compileUtil -->_getVMVal()  里面完成，forEach循环时会从父级开始取值，间接调用了它的getter
    // 触发了addDep(), 在整个循环过程，当前wacher都会加入到每个父级过程属性的dep
    // 例如：当前watcher的是'child.child.name', 那么child, child.child, child.child.name这三个属性的dep都会加入当前watcher
 	Watcher.prototype = {
 		update: function () {
 			this.run()
 		},

 		run: function () {
 			var value = this.get(); // 取到最新值
	        var oldVal = this.value; // 原来的值
	        if (value !== oldVal) {
	            this.value = value;
	            this.cb.call(this.vm, value, oldVal); // 执行watcher绑定的回调函数
	        }
 		},

 		addDep: function (dep) {
 			// 判断当前watcher是否已经添加到dep中
 			if (!this.depIds.hasOwnProperty(dep.id)) {
	            dep.addSub(this);
	            this.depIds[dep.id] = dep;
	        }
 		},

 		get: function () {
 			Dep.target = this;	// 将当前订阅者指向自己
 			try{
 				var value = this.getter.call(this.vm, this.vm);	// 触发getter，添加自己到属性订阅器中
 			}catch (e){
 				console.log(e)
 			}
	        // var value = this.getter.call(this.vm, this.vm);	// 触发getter，添加自己到属性订阅器中
	        Dep.target = null;	// 添加完毕，重置
	        return value;
 		},


 		parseGetter: function(exp) {

	        if (/[^\w.$]/.test(exp)) return; 

	        var exps = exp.split('.');
	        // 如果属性的内容是 super.sub, 读取 vm.super.sub的内容
	        return function(obj) {
	            for (var i = 0, len = exps.length; i < len; i++) {
	                if (!obj) return;
	                obj = obj[exps[i]];
	            }
	            return obj;
	        }
	    }
 	};

	/**
	 * Vue主体构造函数
	 */
	function myVue(options) {
		// 必须以构造函数方式调用
		if ( !(this instanceof myVue) ) {
		    // warn('Vue is a constructor and should be called with the `new` keyword');
		}else{
			this._init(options);
		}
	}

	myVue.version = '1.0.0'
	myVue.prototype = {
		constructor: myVue,

		// 初始化
		_init: function (options) {
			// var vm = this;
			this.$options = options || {};
			var data = this._data = options.data || {};
			var vm = this;

			// 数据代理 把访问vm.xxxx指向 vm._data.xxxx
			Object.keys(data).forEach(function(key) {
		        vm._proxy(key);
		    });

		    observer(data);

		    this.$compile = new Compile(options.el || document.body, this)

		},

		_proxy: function (key) {
			var vm = this;

			Object.defineProperty(vm, key, {
				configurable: false,
	            enumerable: true,
	            get: function proxyGetter() {
	                return vm._data[key];
	            },
	            set: function proxySetter(newVal) {
	                vm._data[key] = newVal;
	            }
			})
		}

	};


	return myVue
}));