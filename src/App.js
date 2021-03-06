import React, { Component } from 'react';
import Markdown from 'markdown-to-jsx';
import AceEditor from 'react-ace';
import styled from 'styled-components';
import dateFns from 'date-fns';
import brace from 'brace';
import 'brace/mode/markdown';
import 'brace/theme/dracula';
import './App.css';

const electron = window.require('electron');
const settings = window.require('electron-settings');
const { ipcRenderer } = electron;
const fs = electron.remote.require('fs');

class App extends Component {
  state = {
    loadedFile: '',
    filesData: [],
    activeIndex: 0,
    newEntry: false,
    newEntryName: '',
    directory: settings.get('directory') || null,
  };

  constructor() {
    super();

    // On Load
    const directory = settings.get('directory');
    if (directory) {
      this.loadAndReadFiles(directory);
    }

    ipcRenderer.on('save-file', event => {
      this.saveFile();
    });
    ipcRenderer.on('new-dir', (event, dir) => {
      this.setState({
        directory: dir,
      });
      settings.set('directory', dir);
      this.loadAndReadFiles(dir);
    });
  }

  loadAndReadFiles = directory => {
    fs.readdir(directory, (err, files) => {
      if (files) {
        const filteredFiles = files.filter(file => file.includes('.md'));
        const filesData = filteredFiles.map(file => {
          const date = file.substr(
            file.indexOf('_') + 1,
            file.indexOf('.') - file.indexOf('_') - 1
          );
          return {
            date,
            path: `${directory}/${file}`,
            title: file.substr(0, file.indexOf('_')),
          };
        });

        //* sort files
        filesData.sort((a, b) => {
          const aDate = new Date(a.date);
          const bDate = new Date(b.date);
          const aSec = aDate.getTime();
          const bSec = bDate.getTime();
          return bSec - aSec;
        });

        this.setState(
          {
            filesData,
          },
          () => this.loadFile(0)
        );
      } else {
        this.setState({ filesData: [] });
      }
    });
  };

  changeFile = index => () => {
    const { activeIndex } = this.state;
    if (index !== activeIndex) {
      this.saveFile();
      this.loadFile(index);
    }
  };

  loadFile = index => {
    const { filesData } = this.state;
    const content = fs.readFileSync(filesData[index].path).toString();

    this.setState({
      loadedFile: content,
      activeIndex: index,
    });
  };

  saveFile = () => {
    const { activeIndex, loadedFile, filesData } = this.state;
    fs.writeFile(filesData[activeIndex].path, loadedFile, err => {
      if (err) {
        return console.error(err);
      }
      console.log('saved');
    });
  };

  newFile = e => {
    e.preventDefault();
    const { newEntryName, directory, filesData } = this.state;
    const fileDate = dateFns.format(new Date(), 'MM-DD-YYYY');
    const filePath = `${directory}/${newEntryName}_${fileDate}.md`;
    fs.writeFile(filePath, '', err => {
      if (err) return console.error(err);

      filesData.unshift({
        path: filePath,
        date: fileDate,
        title: newEntryName,
      });

      this.setState({
        newEntry: false,
        newEntryName: '',
        loadedFile: '',
        filesData,
      });
    });
  };

  render() {
    const {
      loadedFile,
      directory,
      filesData,
      activeIndex,
      newEntry,
      newEntryName,
    } = this.state;
    return (
      <AppWrap>
        <Header>Journal</Header>
        {directory ? (
          <Split>
            <FilesWindow>
              <Button onClick={() => this.setState({ newEntry: !newEntry })}>
                + New Entry
              </Button>
              {newEntry && (
                <form action="" onSubmit={this.newFile}>
                  <EntryInput
                    value={newEntryName}
                    onChange={e =>
                      this.setState({ newEntryName: e.target.value })
                    }
                    autoFocus
                    type="text"
                  />
                </form>
              )}
              {filesData.map((file, index) => (
                <FileButton
                  active={activeIndex === index}
                  onClick={this.changeFile(index)}
                >
                  <p className="title">{file.title}</p>
                  <p className="date">{formatDate(file.date)}</p>
                </FileButton>
              ))}
            </FilesWindow>
            <CodeWindow>
              <AceEditor
                mode="markdown"
                theme="dracula"
                onChange={newContent => {
                  this.setState({
                    loadedFile: newContent,
                  });
                }}
                name="markdown_editor"
                value={loadedFile}
              />
            </CodeWindow>
            <RenderedWindow>
              <Markdown>{loadedFile}</Markdown>
            </RenderedWindow>
          </Split>
        ) : (
          <LoadingMessage>
            <h1>Press CmdORCtrl+O to open a directory</h1>
          </LoadingMessage>
        )}
      </AppWrap>
    );
  }
}

export default App;

const AppWrap = styled.div`
  margin-top: 23px;
`;

const Header = styled.header`
  background-color: #191324;
  color: #75717c;
  font-size: 0.8rem;
  height: 23px;
  text-align: center;
  position: fixed;
  box-shadow: 0px 3px 3px rgba(0, 0, 0, 0.2);
  top: 0;
  left: 0;
  width: 100%;
  z-index: 10;
  -webkit-app-region: drag;
`;

const LoadingMessage = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  color: #fff;
  background-color: #191324;
`;

const Split = styled.div`
  display: flex;
  height: 100vh;
`;

const FilesWindow = styled.div`
  background: #140f1d;
  border-right: 1px solid #302b3a;
  position: relative;
  width: 20%;
  &:after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    bottom: 0;
    pointer-events: none;
    box-shadow: -10px 0 20px rgba(0, 0, 0, 0.3) inset;
  }
`;

const CodeWindow = styled.div`
  flex: 1;
  padding-top: 2rem;
  background-color: #191324;
`;

const RenderedWindow = styled.div`
  background-color: #191324;
  width: 35%;
  padding: 20px;
  color: #fff;
  border-left: 1px solid #302b3a;
  overflow: auto;
  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    color: #82d8d8;
  }
  h1 {
    border-bottom: solid 3px #e54b4b;
    padding-bottom: 10px;
  }
  a {
    color: #e54b4b;
  }
`;

const FileButton = styled.button`
  padding: 10px;
  width: 100%;
  background: #191324;
  opacity: 0.4;
  color: white;
  border: none;
  text-align: left;
  border-bottom: 1px solid #302b3a;
  transition: 0.3s ease all;
  outline: none;
  &:hover {
    opacity: 1;
    border-left: 4px solid #82d8d8;
  }
  .title {
    font-weight: bold;
    font-size: 0.9rem;
    margin: 0 0 5px;
  }
  .date {
    margin: 0;
  }
  ${({ active }) =>
    active &&
    `opacity: 1;
    border-left: 4px solid #82d8d8;`}
`;

const Button = styled.button`
  background: transparent;
  color: white;
  display: block;
  border: 1px solid #82d8d8;
  margin: 1rem auto;
  font-size: 1rem;
  transition: 0.3s ease all;
  padding: 5px 10px;
  &:hover {
    background: #82d8d8;
    color: #191324;
  }
`;

const EntryInput = styled.input`
  width: 100%;
  height: 30px;
  background-color: #82d8d8;
  font-size: 1rem;
`;

const formatDate = date => dateFns.format(new Date(date), 'MMMM Do YYYY');
