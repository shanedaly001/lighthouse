/**
 * @license Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const ComputedArtifact = require('../computed-artifact');
const Node = require('../../../lib/dependency-graph/node');
const NetworkNode = require('../../../lib/dependency-graph/network-node'); // eslint-disable-line no-unused-vars
const Simulator = require('../../../lib/dependency-graph/simulator/simulator');
const WebInspector = require('../../../lib/web-inspector');

class LanternMetricArtifact extends ComputedArtifact {
  /**
   * @param {!Node} dependencyGraph
   * @param {function(NetworkNode):boolean=} condition
   * @return {!Set<string>}
   */
  static getScriptUrls(dependencyGraph, condition) {
    const scriptUrls = new Set();

    dependencyGraph.traverse(node => {
      if (node.type === Node.TYPES.CPU) return;
      const asNetworkNode = /** @type {NetworkNode} */ (node);
      if (asNetworkNode.record._resourceType !== WebInspector.resourceTypes.Script) return;
      if (condition && !condition(asNetworkNode)) return;
      scriptUrls.add(asNetworkNode.record.url);
    });

    return scriptUrls;
  }

  /**
   * @return {LH.Gatherer.Simulation.MetricCoefficients}
   */
  get COEFFICIENTS() {
    throw new Error('COEFFICIENTS unimplemented!');
  }

  /**
   * @param {!Node} dependencyGraph
   * @param {LH.Gatherer.Artifact.TraceOfTab} traceOfTab
   * @return {!Node}
   */
  getOptimisticGraph(dependencyGraph, traceOfTab) { // eslint-disable-line no-unused-vars
    throw new Error('Optimistic graph unimplemented!');
  }

  /**
   * @param {!Node} dependencyGraph
   * @param {LH.Gatherer.Artifact.TraceOfTab} traceOfTab
   * @return {!Node}
   */
  getPessimisticGraph(dependencyGraph, traceOfTab) { // eslint-disable-line no-unused-vars
    throw new Error('Pessmistic graph unimplemented!');
  }

  /**
   * @param {LH.Gatherer.Simulation.Result} simulationResult
   * @param {any=} extras
   * @return {LH.Gatherer.Simulation.Result}
   */
  getEstimateFromSimulation(simulationResult, extras) { // eslint-disable-line no-unused-vars
    return simulationResult;
  }

  /**
   * @param {{trace: Object, devtoolsLog: Object}} data
   * @param {Object} artifacts
   * @param {any=} extras
   * @return {Promise<LH.Gatherer.Artifact.LanternMetric>}
   */
  async computeMetricWithGraphs(data, artifacts, extras) {
    const {trace, devtoolsLog} = data;
    const graph = await artifacts.requestPageDependencyGraph({trace, devtoolsLog});
    const traceOfTab = await artifacts.requestTraceOfTab(trace);
    const networkAnalysis = await artifacts.requestNetworkAnalysis(devtoolsLog);

    const optimisticGraph = this.getOptimisticGraph(graph, traceOfTab);
    const pessimisticGraph = this.getPessimisticGraph(graph, traceOfTab);

    // TODO(phulce): use rtt and throughput from config.settings instead of defaults
    const options = {
      additionalRttByOrigin: networkAnalysis.additionalRttByOrigin,
      serverResponseTimeByOrigin: networkAnalysis.serverResponseTimeByOrigin,
    };

    const optimisticSimulation = new Simulator(optimisticGraph, options).simulate();
    const pessimisticSimulation = new Simulator(pessimisticGraph, options).simulate();

    const optimisticEstimate = this.getEstimateFromSimulation(
      optimisticSimulation,
      Object.assign({}, extras, {optimistic: true})
    );

    const pessimisticEstimate = this.getEstimateFromSimulation(
      pessimisticSimulation,
      Object.assign({}, extras, {optimistic: false})
    );

    const timing =
      this.COEFFICIENTS.intercept +
      this.COEFFICIENTS.optimistic * optimisticEstimate.timeInMs +
      this.COEFFICIENTS.pessimistic * pessimisticEstimate.timeInMs;

    return {
      timing,
      optimisticEstimate,
      pessimisticEstimate,
      optimisticGraph,
      pessimisticGraph,
    };
  }

  /**
   * @param {{trace: Object, devtoolsLog: Object}} data
   * @param {Object} artifacts
   * @return {Promise<LH.Gatherer.Artifact.LanternMetric>}
   */
  compute_(data, artifacts) {
    return this.computeMetricWithGraphs(data, artifacts);
  }
}

module.exports = LanternMetricArtifact;
