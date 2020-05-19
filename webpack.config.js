import {resolve} from 'path';
import * as HtmlWebpackPlugin from 'html-webpack-plugin';
import * as CopyPlugin from 'copy-webpack-plugin';

const dirname = path.dirname(new URL(import.meta.url).pathname);

module.exports = {
	mode: 'development',
	context: resolve(dirname, 'example'),
	entry: [
		'./index.js',
		'./index.css',
		'./tools/dom_extension.js',
	],
	output: {
		path: resolve(dirname, 'example', 'dist'),
		filename: '[name].bundle.js'
	},
	plugins: [
		new HtmlWebpackPlugin({
			template: './index.html',
			inject: 'head',
			xhtml: true
		}),
		new CopyPlugin({
			patterns: [
				{from: '../test/resources/*.dcm', to: './test', flatten: true}
			],
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
					'file-loader',
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
		contentBase: './dist',
		port: 9000,
		host: '0.0.0.0'
	}
};