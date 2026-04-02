# 欢迎使用您的 VS Code 扩展

## 文件夹内容

* 此文件夹包含扩展所需的所有文件。
* `package.json` - 这是扩展的清单文件，用于声明扩展和命令。
  * 示例插件注册了一个命令并定义了其标题和命令名称。有了这些信息，VS Code 可以在命令面板中显示该命令，而无需立即加载插件。
* `src/extension.ts` - 这是主文件，您将在此实现命令的功能。
  * 该文件导出一个 `activate` 函数，在扩展首次激活时调用（本例中通过执行命令触发）。在 `activate` 函数中，我们调用 `registerCommand`。
  * 我们将包含命令实现的函数作为第二个参数传递给 `registerCommand`。

## 环境设置

* 安装推荐的扩展（amodio.tsl-problem-matcher、ms-vscode.extension-test-runner 和 dbaeumer.vscode-eslint）

## 快速开始

* 按 `F5` 打开新窗口并加载您的扩展。
* 通过命令面板（`Ctrl+Shift+P` 或 Mac 上的 `Cmd+Shift+P`）运行命令，输入 `Hello World`。
* 在 `src/extension.ts` 中设置断点以调试扩展。
* 在调试控制台中查看扩展的输出。

## 进行修改

* 修改 `src/extension.ts` 后，可以通过调试工具栏重新启动扩展。
* 也可以重新加载（`Ctrl+R` 或 Mac 上的 `Cmd+R`）VS Code 窗口以加载更改。

## 探索 API

* 打开 `node_modules/@types/vscode/index.d.ts` 可以查看完整的 VS Code API。

## 运行测试

* 安装 [Extension Test Runner](https://marketplace.visualstudio.com/items?itemName=ms-vscode.extension-test-runner)
* 通过 **任务: 运行任务** 运行 "watch" 任务。确保此任务正在运行，否则测试可能无法被发现。
* 从活动栏打开测试视图并点击 "运行测试" 按钮，或使用快捷键 `Ctrl/Cmd + ; A`
* 在测试结果视图中查看测试输出。
* 修改 `src/test/extension.test.ts` 或在 `test` 文件夹中创建新的测试文件。
  * 提供的测试运行器只会匹配名称模式为 `**.test.ts` 的文件。
  * 您可以在 `test` 文件夹内创建子文件夹，以任何方式组织测试。

## 下一步

* 通过 [打包扩展](https://code.visualstudio.com/api/working-with-extensions/bundling-extension) 减小扩展大小并提高启动速度。
* 在 VS Code 扩展市场上 [发布您的扩展](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)。
* 通过设置 [持续集成](https://code.visualstudio.com/api/working-with-extensions/continuous-integration) 自动化构建流程。
