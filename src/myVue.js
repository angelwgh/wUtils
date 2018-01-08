/**
 * 实现观察者Observer
 */


function observer(data) {
	if(!data || typeof data !== 'object'){
		return
	}

	//遍历data中的属性
	Object.keys(data).forEach(function (key) {
		defineReactive(data, key, data[key])
	})
}

function defineReactive(data, key, value) {
	// 这是一个闭包，每个属性都有各自的订阅者
	var dep = new Dep()

	// 如果value是一个对象，则监听子属性
	observer(value)

	Object.defineProperty(data, key, {
		enumerable: true, //可枚举
		configurable: false, // 不可define
		get: function () {
			// 由于需要在闭包内添加watcher，所以通过Dep定义一个全局target属性，暂存watcher, 添加完移除

			Dep.target && dep.addsub(Dep.target)
			return value;
		},
		set: function (newVal) {
			if (value === newVal) return;
			// console.log('哈哈哈，监听到值变化了 ', value, ' --> ', newVal);
			value = newVal;
			dep.notify()
		}
	})
}




// 一个消息订阅器，很简单，维护一个数组，用来收集订阅者，数据变动触发notify，再调用订阅者的update方法

function Dep() {
	this.subs = []
}

Dep.prototype = {
	// 添加订阅者
	addsub: function (sub) {
		this.subs.push(sub)
	},
	//通知订阅者
	notify: function () {
		this.subs.forEach(function (sub) {
			sub.update();
		})
	}
}


/**
 * 实现Compile
 */
//compile主要做的事情是解析模板指令，将模板中的变量替换成数据，然后初始化渲染页面视图，
//并将每个指令对应的节点绑定更新函数，添加监听数据的订阅者，一旦数据有变动，收到通知，更新视图
//


//因为遍历解析的过程有多次操作dom节点，为提高性能和效率，
//会先将跟节点el转换成文档碎片fragment进行解析编译操作，解析完成，再将fragment添加回原来的真实dom节点中

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
	init: function () {
		this.compileElement(this.$fragment);
	},

	node2Fragment: function (el) {
		var fragment = document.createDocumentFragment(),
			child;
			// 将源生节点拷贝到fragment
		while (child = el.firstChild){
			fragment.appendChild(child);
		}

		return 	fragment;
	},

	// 历所有节点及其子节点，进行扫描解析编译，
	// 调用对应的指令渲染函数进行数据渲染，并调用对应的指令更新函数进行绑定
	compileElement: function (el) {
		var childNodes = el.childNodes, 
			self = this;
		[].slice.call(childNodes).forEach(function (node) {
			var text = node.textContent;
			var reg = /\{\{(.*)\}\}/;	// 表达式文本

			// 按元素节点方式编译
			if(self.isElementNode(node)){
				self.compile(node)
			// 编译文本节点
			}else if (self.isTextNode(node) && reg.test(text)) {
				self.compileText(node,RegExp.$1)
			}

			// // 遍历编译子节点
			if(node.childNodes && node.childNodes.length){
				self.compileElement(node)
			}
		})
	},

	compile: function (node) {
		var nodeAttrs = node.attributes,
			self = this;

		[].slice.call(nodeAttrs).forEach(function (attr) {
			// 规定：指令以 v-xxx 命名
	        // 如 <span v-text="content"></span> 中指令为 v-text
	        var attrName = attr.name;	// v-text
	        if(self.isDirective(attrName)){
	        	var exp = attr.value; // content
                var dir = attrName.substring(2);	

                if(self.isEventDirective(dir)){
                	// 事件指令如 v-on:click
                	
                	compileUtil.eventHandler(node, self.$vm, exp, dir);
                }else {
                	// 普通指令
                    compileUtil[dir] && compileUtil[dir](node, self.$vm, exp);
                }

	        }
		})
		
	},

	compileText: function(node, exp) {
        compileUtil.text(node, this.$vm, exp);
    },

	// 元素节点
	isElementNode: function (node) {
		return node.nodeType == 1;
	},

	// 文本节点
	isTextNode: function(node) {
        return node.nodeType == 3;
    },

    isDirective: function(attr) {
        return attr.indexOf('v-') == 0;
    },

    isEventDirective: function(dir) {
        return dir.indexOf('on') === 0;
    },
};

// 指令处理集合
var compileUtil = {
    text: function(node, vm, exp) {
        this.bind(node, vm, exp, 'text');
    },
    // ...
    bind: function(node, vm, exp, dir) {
        var updaterFn = updater[dir + 'Updater'];
        // 第一次初始化视图
        updaterFn && updaterFn(node, vm[exp]);
        // 实例化订阅者，此操作会在对应的属性消息订阅器中添加了该订阅者watcher
        new Watcher(vm, exp, function(value, oldValue) {
        	// 一旦属性值有变化，会收到通知执行此更新函数，更新视图
            updaterFn && updaterFn(node, value, oldValue);
        });
    }
};

// 更新函数
var updater = {
    textUpdater: function(node, value) {
        node.textContent = typeof value == 'undefined' ? '' : value;
    }
    // ...
};


/**
 * 实现watcher
 */

function Watcher(vm, exp, cb) {
	this.cb = cb;
    this.vm = vm;
    this.exp = exp;
    // 此处为了触发属性的getter，从而在dep添加自己，结合Observer更易理解
    this.value = this.get(); 
}

Watcher.prototype = {
	update: function() {
        this.run();	// 属性值变化收到通知
    },
    run: function() {
        var value = this.get(); // 取到最新值
        var oldVal = this.value;
        if (value !== oldVal) {
            this.value = value;
            this.cb.call(this.vm, value, oldVal); // 执行Compile中绑定的回调，更新视图
        }
    },
	get: function() {
        Dep.target = this;	// 将当前订阅者指向自己
        var value = this.vm[this.exp];	// 触发getter，添加自己到属性订阅器中
        Dep.target = null;	// 添加完毕，重置
        return value;
    }
};

// var compile = new Compile('#app')


/**
 * 实现MVVM
 */

function MVVM (options) {
	this.$options = options;
	var data = this._data = this.$options.data;
	var self = this;
	Object.keys(data).forEach(function(key) {
        self._proxy(key);
    });
	observer(data);

	this.$compile = new Compile(options.el || document.body, this)
}

MVVM.prototype = {
	_proxy: function (key) {
		var self = this;
		// 属性代理， 使得访问vm.key变为访问self._data.key
		Object.defineProperty(self, key, {
			configurable: false,
            enumerable: true,
            get: function proxyGetter() {
                return self._data[key];
            },
            set: function proxySetter(newVal) {
                self._data[key] = newVal;
            }
		})
	}
};

