#!/bin/bash

. stderr-messages.sh
. arg-processor.sh

opt-value --var=a --enum='a b c' a
opt-value --var=b --init=xyz b=floop
opt-toggle --var=c --filter=yes-no c
function yes-no {
    if [[ $1 == 1 ]]; then
        echo yes
    else
        echo no
    fi
}
opt-action --var=d --filter='filter-blort' d=bingo
function filter-blort {
    echo "blort $1"
}

process-args "$@"
error="$?"
echo 1>&2 "##### error? ${error}"

echo "A >>${a}<<"
echo "B >>${b}<<"
echo "C >>${c}<<"
echo "D >>${d}<<"
