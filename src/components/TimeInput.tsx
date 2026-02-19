import React, { useState, useEffect, useRef } from 'react';

interface TimeInputProps {
    value: string;
    onChange: (value: string) => void;
}

const TimeInput: React.FC<TimeInputProps> = ({ value, onChange }) => {
    const [localParts, setLocalParts] = useState(value.split(':'));
    const isInternalUpdate = useRef(false);
    // Keep a ref that always reflects the latest parts to avoid React batching issues
    const latestParts = useRef(localParts);

    useEffect(() => {
        if (!isInternalUpdate.current) {
            setLocalParts(value.split(':'));
            latestParts.current = value.split(':');
        }
        isInternalUpdate.current = false;
    }, [value]);

    const hhRef = useRef<HTMLInputElement>(null);
    const mmRef = useRef<HTMLInputElement>(null);
    const ssRef = useRef<HTMLInputElement>(null);

    const notifyChange = (newParts: string[]) => {
        isInternalUpdate.current = true;
        onChange(newParts.join(':'));
    };

    const updatePart = (index: number, rawVal: string) => {
        const cleanVal = rawVal.replace(/\D/g, '').slice(0, 2);
        const newParts = [...latestParts.current];
        newParts[index] = cleanVal;
        setLocalParts(newParts);
        latestParts.current = newParts;

        if (cleanVal.length === 2) {
            notifyChange(newParts);
            // Move focus AFTER updating the ref so handleBlur reads the correct value
            if (index === 0) mmRef.current?.focus();
            else if (index === 1) ssRef.current?.focus();
        }
    };

    const handleBlur = (index: number) => {
        // Read from ref to get the LATEST value, not the potentially stale state
        const newParts = [...latestParts.current];
        newParts[index] = (newParts[index] || '00').padStart(2, '0');
        setLocalParts(newParts);
        latestParts.current = newParts;
        notifyChange(newParts);
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        e.target.select();
    };

    const boxStyle: React.CSSProperties = {
        width: 36,
        height: 36,
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s ease',
    };

    const boxFocusStyle: React.CSSProperties = {
        ...boxStyle,
        borderColor: 'rgba(59,130,246,0.4)',
        boxShadow: '0 0 0 2px rgba(59,130,246,0.1), 0 0 12px rgba(59,130,246,0.08)',
    };

    const inputStyle: React.CSSProperties = {
        width: '100%',
        height: '100%',
        backgroundColor: 'transparent',
        textAlign: 'center',
        border: 'none',
        outline: 'none',
        fontSize: 12,
        fontFamily: "'SF Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        fontWeight: 800,
        color: '#fff',
        padding: 0,
        margin: 0,
        letterSpacing: '0.05em',
    };

    const [focused, setFocused] = useState<number | null>(null);

    const renderBox = (ref: React.RefObject<HTMLInputElement>, idx: number) => (
        <div style={focused === idx ? boxFocusStyle : boxStyle}>
            <input
                ref={ref}
                type="text"
                value={localParts[idx] === '00' ? '' : localParts[idx]}
                placeholder="00"
                maxLength={2}
                onFocus={(e) => { setFocused(idx); handleFocus(e); }}
                onBlur={() => { setFocused(null); handleBlur(idx); }}
                onChange={(e) => updatePart(idx, e.target.value)}
                style={{
                    ...inputStyle,
                    ...(localParts[idx] === '00' || !localParts[idx] ? { color: '#334155' } : {}),
                }}
            />
        </div>
    );

    return (
        <div className="flex items-center" style={{ gap: 6 }}>
            {renderBox(hhRef, 0)}
            {renderBox(mmRef, 1)}
            {renderBox(ssRef, 2)}
        </div>
    );
};

export default TimeInput;
