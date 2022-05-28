/*
 * @file Contains the ProcessService.
 * @Author: Dennis Jung
 * @Author: Konrad Müller
 * @Date: 2018-06-13 20:34:03
 * @Last Modified by: Dennis Jung
 * @Last Modified time: 2018-06-16 15:09:08
 */

import * as child_process from "child_process";
import { Disposable } from "vscode";
import ProcessDetail from "../models/ProcessDetail";

/**
 * The ProcessService. Provides functionality to scan and parse processes running.
 *
 * @export
 * @class ProcessService
 */
export default class ProcessService implements Disposable {
  /**
   * Dispose
   *
   * @memberof ProcessService
   */
  public dispose(): void {}

  /**
   * Gets all Processes, with ppid filter if set.
   *
   * @param {string} [ppid=""]
   * @returns {Array<ProcessDetail>}
   * @memberof ProcessService
   */
  public GetProcesses(ppid = ""): Array<ProcessDetail> {
    if (process.platform === "win32") {
      return this.getProcessDetailsFromWindows(ppid);
    } else {
      // unix
      return this.getProcessDetailsFromUnix(ppid);
    }
  }
  /**
   * Get all ProcessDetails on unix, with ppid filter if set.
   *
   * @private
   * @param {string} [ppid=""]
   * @returns {Array<ProcessDetail>}
   * @memberof ProcessService
   */
  private getProcessDetailsFromUnix(ppid = ""): Array<ProcessDetail> {
    const cmlPattern = /^([0-9]+)\s+([0-9]+)\s(.+$)/;

    // build and execute command line tool "ps" to get details of all running processes
    const args = ["-e -o pid,ppid,command"];
		const tmp = child_process.execSync(`ps ${args}`).toString();

    // split process informations results for each process
    const processLines = tmp
      .split("\n")
      .map((str) => {
        return str.trim();
      })
      .filter((str) => cmlPattern.test(str));

    // parse output to a ProcessDetail list
    const processDetails = new Array<ProcessDetail>();
    processLines.forEach((str) => {
      const s = cmlPattern.exec(str);
      if (
        s &&
        s.length === 4 && // validate regex result
        (ppid === "" || s[2] === ppid)
      ) {
        // apply parent process filter
        processDetails.push(new ProcessDetail(s[1], s[2], s[3]));
      }
    });

    //Find nested child processes
    if (processDetails.length !== 0 && ppid !== "") {
      const childs = new Array<ProcessDetail>();
      processDetails.forEach((k) => {
        const tmp = this.getProcessDetailsFromUnix(k.pid.toString());
        tmp.forEach((l) => childs.push(l));
      });
      return processDetails.concat(childs);
    }
    return processDetails;
  }

  /**
   * Get all ProcessDetails on windows, with ppid filter if set.
   *
   * @private
   * @param {string} [ppid=""]
   * @returns {Array<ProcessDetail>}
   * @memberof ProcessService
   */
  private getProcessDetailsFromWindows(ppid = ""): Array<ProcessDetail> {
    const cmlPattern = /^(.+)\s+([0-9]+)\s+([0-9]+)$/;
    let args = ["process", "get", "ProcessId,ParentProcessId,CommandLine"];
    if (ppid !== "") {
      args = ["process", "where", `parentProcessId=${ppid}`, "get", "ProcessId,ParentProcessId,CommandLine"];
    }

    const tmp = child_process.execFileSync("wmic.exe", args, {
      encoding: "utf8",
    });

    const processLines = tmp
      .split("\r\n")
      .map((str) => {
        return str.trim();
      })
      .filter((str) => cmlPattern.test(str));

    const processDetails = new Array<ProcessDetail>();
    processLines.forEach((str) => {
      const s = cmlPattern.exec(str);
      if (s && s.length === 4) {
        processDetails.push(new ProcessDetail(s[3], s[2], s[1]));
      }
    });
    if (processDetails.length !== 0 && ppid !== "") {
      const childs = new Array<ProcessDetail>();
      processDetails.forEach((k) => {
        const tmp = this.getProcessDetailsFromWindows(k.pid.toString());
        tmp.forEach((l) => childs.push(l));
      });
      return processDetails.concat(childs);
    }
    return processDetails;
  }
}
