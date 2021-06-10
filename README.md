## mp-poster

小程序海报

```xml
<canvas type='2d' canvsa-id='drawCanvas' id='drawCanvas' :style="`width: ${width}px; height: ${height}px;`"></canvas>
```

资源加载

```js
let load = new Tu.Loader([
	{ name: 'backgroundPic', url: 'http://.......backgroundPic.png' }
])

load.on('progress', function (current, count) {
	// 加载过程回调
})
load.on('loaded', function () {
	// 加载完成！
})

load.load()
```

创建渲染器

```js
const renderer = new Tu.Renderer(
	'#drawCanvas',
	{
		width: 750,
		height: 1334
	},
	function done () {

	}
)
```

创建容器

```js
const container = new Tu.Container()

renderer.tick.add(function () {
	renderer.render(container)
})
renderer.run();
```

绘制矩形

```js
const container = new Tu.Container()
const rect = new Tu.Rect(
	300, // 宽
	300, // 高
)

rect.borderRadius = 10 // 设置圆角半径为10
rect.color = 'wheat' 		// 设置矩形背景色
container.addChild(rect);
```

绘制图片

```js
const bg = new Sprite('backgroundPic')
bg.x = 10
bg.y = 10
container.addChild(bg);
```

绘制文本

```js
const text = new Tu.Text('text content')
text.color = '#fff'
text.fontFamily = 'Comic Sans MS'
text.fontSize = 20
container.addChild(text);
```




