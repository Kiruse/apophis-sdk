/** Implementation of Tendermint transaction query, with some convenience methods.
 *
 * Fields are formatted as `event_type.attribute_name`.
 *
 * @see https://docs.tendermint.com/v0.34/rpc/#/Websocket/subscribe
 */
export class TendermintQuery {
  private _query: string[] = [];

  /** Helper method to format values as Tendermint query strings. */
  getValue(value: number | bigint | string | Date) {
    if (typeof value === 'number' || typeof value === 'bigint') {
      return value.toString();
    } else if (typeof value === 'string') {
      return `'${escape(value)}'`;
    } else {
      return value.toISOString();
    }
  }

  /** Filter for exact matches. */
  exact(field: string, value: number | bigint | string | Date) {
    this._query.push(`${field}=${this.getValue(value)}`);
    return this;
  }

  /** Filter for simple comparisons. */
  compare(field: string, op: `${'<' | '>'}${'' | '='}`, value: number | bigint | Date) {
    this._query.push(`${field}${op}${this.getValue(value)}`);
    return this;
  }

  /** Filter for the existence of the given field in a transaction. */
  exists(field: string) {
    this._query.push(`${field} EXISTS`);
    return this;
  }

  /** Filter for a substring match in the given field. */
  contains(field: string, value: string) {
    this._query.push(`${field} CONTAINS '${escape(value)}'`);
    return this;
  }

  /** Shorthand for `.exact('message.sender', address)`. */
  sender(address: string) {
    this.exact('message.sender', address);
    return this;
  }

  /** Shorthand for finding events emitted by a specific contract.
   *
   * Note: Smart Contract Events are always prefixed with `wasm-`. This method cannot be used to find
   * events emitted by other SDK modules.
   */
  event(type: string, contractAddress: string) {
    this.exact(`wasm-${type}._contract_address`, contractAddress);
    return this;
  }

  /** Shorthand for finding the given event emitted by any smart contract.
   *
   * Note: Smart Contract Events are always prefixed with `wasm-`. This method cannot be used to find
   * events emitted by other SDK modules.
   */
  hasEvent(type: string) {
    this.exists(`wasm-${type}._contract_address`);
    return this;
  }

  clone() {
    const q = new TendermintQuery();
    q._query = this._query.slice();
    return q;
  }

  toString() {
    return this._query.join(' AND ');
  }
}

const escape = (str: string) => str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
