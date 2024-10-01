/** Implementation of Tendermint transaction query.
 *
 * @see https://docs.tendermint.com/v0.34/rpc/#/Websocket/subscribe
 */
export class TendermintQuery {
  private _query: string[] = [];

  getValue(value: number | bigint | string | Date) {
    if (typeof value === 'number' || typeof value === 'bigint') {
      return value.toString();
    } else if (typeof value === 'string') {
      return `'${escape(value)}'`;
    } else {
      return value.toISOString();
    }
  }

  exact(field: string, value: number | string | Date) {
    this._query.push(`${field}=${this.getValue(value)}`);
    return this;
  }

  compare(field: string, op: `${'<' | '>'}${'' | '='}`, value: number | bigint | Date) {
    this._query.push(`${field}${op}${this.getValue(value)}`);
    return this;
  }

  exists(field: string) {
    this._query.push(`${field} EXISTS`);
    return this;
  }

  contains(field: string, value: string) {
    this._query.push(`${field} CONTAINS '${escape(value)}'`);
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
