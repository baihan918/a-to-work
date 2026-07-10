import { useEffect, useState, useRef } from 'react';

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * @param {Function} service 返回 Promise 的请求函数
 * @param {Object} options 配置
 */
function useRequest(service, options = {}) {
  const {
    manual = false,
    defaultParams = [],
    onSuccess,
    onError,
  } = options;

  const [data, setData] = useState();
  const [error, setError] = useState();
  const [loading, setLoading] = useState(false);

  // 标记组件是否还挂载
  const mountedRef = useRef(false);

  // 请求序号，用来解决竞态问题
  const countRef = useRef(0);

  const run = useCallback(
    async (...params) => {
      const currentCount = ++countRef.current;

      setLoading(true);
      setError(undefined);

      try {
        const result = await service(...params);

        // 如果组件已卸载，或者不是最后一次请求，忽略
        if (!mountedRef.current || currentCount !== countRef.current) {
          return result;
        }

        setData(result);
        setLoading(false);

        onSuccess && onSuccess(result, params);

        return result;
      } catch (err) {
        if (!mountedRef.current || currentCount !== countRef.current) {
          throw err;
        }

        setError(err);
        setLoading(false);

        onError && onError(err, params);

        throw err;
      }
    },
    [service, onSuccess, onError]
  );

  const cancel = useCallback(() => {
    // 让当前请求失效
    countRef.current += 1;

    if (mountedRef.current) {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    if (!manual) {
      run(...defaultParams);
    }

    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    data,
    error,
    loading,
    run,
    cancel,
  };
}

export default useRequest;


// demo
function getUser(id) {
  return fetch(`/api/user/${id}`).then(res => res.json());
}

function Demo() {
  const { data, loading, error, run, cancel } = useRequest(getUser, {
    manual: true,
    onSuccess(data) {
      console.log("success", data);
    },
    onError(error) {
      console.log("error", error);
    },
  });

  return (
    <div>
      <button onClick={() => run(1)}>请求用户 1</button>
      <button onClick={cancel}>取消</button>

      {loading && <div>loading...</div>}
      {error && <div>error</div>}
      {data && <div>{data.name}</div>}
    </div>
  );
}