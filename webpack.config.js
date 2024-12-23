import path from 'path';
import {fileURLToPath} from 'url';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import CopyPlugin from 'copy-webpack-plugin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
	mode: 'development',
	context: path.resolve(__dirname, 'example'),
	entry: [
		'./index.js',
		'./index.css'
	],
	output: {
		path: path.resolve(__dirname, 'example', 'dist'),
		filename: '[name].bundle.js'
	},
	plugins: [
		new HtmlWebpackPlugin({
			template: path.join(__dirname, 'example', 'index.html'),
			inject: 'head',
			xhtml: true
		}),
		new CopyPlugin({
			patterns: [
				{from: '../test/resources/*.dcm', to: './test/[name].dcm'}
			]
		})
	],
	module: {
		rules: [
			{
				test: /\.css$/,
				use: [
					'style-loader',
					'css-loader'
				]
			},
			{
				test: /\.png$/,
				use: [
					'file-loader'
				]
			},
			{
				test: /workers/,
				use: {
					loader: 'worker-loader'
				}
			}
		]
	},
	devServer: {
		port: 9000
	}
};
