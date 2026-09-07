"use client";

import { useEffect, useMemo, useState } from "react";

// 集市图片（缩略图/头像/详情大图）：在镜像候选里逐个换源。
// 大陆直连 jsDelivr 常年被 DNS 污染，单镜像 <img> 挂了就永远挂；
// onError 后移到下一个候选，全部失败时隐藏自己（外层占位样式接手）。
export function HubImg({ candidates, alt, className, loading, width, height, onResolved }: {
    candidates: string[];
    alt: string;
    className?: string;
    loading?: "lazy" | "eager";
    width?: number;
    height?: number;
    onResolved?: (url: string) => void;
}) {
    const key = useMemo(() => candidates.join("\n"), [candidates]);
    const [index, setIndex] = useState(0);

    useEffect(() => { setIndex(0); }, [key]);
    useEffect(() => {
        if (index < candidates.length) onResolved?.(candidates[index]);
        // onResolved 是父组件的回调，跟随 key/index 变化即可
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, index]);

    if (index >= candidates.length) return null;
    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={candidates[index]}
            alt={alt}
            className={className}
            loading={loading}
            width={width}
            height={height}
            onError={() => setIndex(i => i + 1)}
        />
    );
}
