/**
 * Adapter Registry
 * Exports instantiated source adapters and provides factory helpers.
 */

const GreenhouseAdapter = require("./greenhouseAdapter");
const LeverAdapter = require("./leverAdapter");
const AshbyAdapter = require("./ashbyAdapter");
const RemotiveAdapter = require("./remotiveAdapter");
const LinkedInAdapter = require("./linkedInAdapter");
const InternshalaAdapter = require("./internshalaAdapter");

function getDefaultAdapters() {
  return [
    new GreenhouseAdapter(),
    new LeverAdapter(),
    new AshbyAdapter(),
    new RemotiveAdapter(),
    new LinkedInAdapter(),
    new InternshalaAdapter()
  ];
}

module.exports = {
  GreenhouseAdapter,
  LeverAdapter,
  AshbyAdapter,
  RemotiveAdapter,
  LinkedInAdapter,
  InternshalaAdapter,
  getDefaultAdapters
};
