# Kerangka simulasi untuk menguji kunci soal Struktur Data.
# Terjemahkan pseudocode kunci baris per baris ke fungsi Python di bawah.
# Akses field dari NIL akan memicu AttributeError -> tanda "akses NIL" pada algoritma.

class Elm:                      # elmList / elmDLL
    def __init__(self, info):
        self.info, self.next, self.prev = info, None, None

class ListSLL:                  # List < first >
    def __init__(self): self.first = None

class ListDLL:                  # ListDLL < first, last >
    def __init__(self): self.first = self.last = None

class Queue:                    # Queue < head, tail > (linked list mirip DLL)
    def __init__(self): self.head = self.tail = None

class Stack:                    # Stack < info : array[1..MAXSIZE], top >
    def __init__(self, maxsize=20):
        self.info = [None] * (maxsize + 1); self.top = 0; self.max = maxsize

# ---------- pembuat & pemeriksa ----------
def sll_from(items):
    L = ListSLL(); prev = None
    for x in items:
        p = Elm(x)
        if prev is None: L.first = p
        else: prev.next = p
        prev = p
    return L

def sll_items(L):
    out, p = [], L.first
    while p is not None: out.append(p.info); p = p.next
    return out

def dll_from(items, cls=ListDLL, a='first', b='last'):
    L = cls(); prev = None
    for x in items:
        p = Elm(x); p.prev = prev
        if prev is None: setattr(L, a, p)
        else: prev.next = p
        prev = p
    setattr(L, b, prev)
    return L

def dll_items(L, a='first', b='last'):
    """Kembalikan isi maju; assert next/prev, first/last konsisten."""
    fwd, p, last = [], getattr(L, a), None
    while p is not None:
        assert p.prev is last, f"prev salah di {p.info}"
        fwd.append(p.info); last = p; p = p.next
    assert getattr(L, b) is last, "last/tail tidak menunjuk elemen terakhir"
    return fwd

def queue_from(items): return dll_from(items, Queue, 'head', 'tail')
def queue_items(Q):   return dll_items(Q, 'head', 'tail')

# ---------- primitif Stack array ----------
def createStack(maxsize=20): return Stack(maxsize)
def isEmpty(S): return S.top == 0
def isFull(S):  return S.top == S.max
def size(S):    return S.top
def peek(S):    return S.info[S.top]
def push(S, x):
    assert not isFull(S), "push ke stack penuh"
    S.top += 1; S.info[S.top] = x
def pop(S):
    assert not isEmpty(S), "pop dari stack kosong"
    x = S.info[S.top]; S.top -= 1; return x
def stack_from(items, maxsize=20):
    S = createStack(maxsize)
    for x in items: push(S, x)
    return S
def stack_items(S): return S.info[1:S.top + 1]       # bottom -> top

# ---------- primitif Queue ----------
def isEmptyQueue(Q): return Q.head is None
def enqueue(Q, p):
    if Q.head is None: Q.head = Q.tail = p
    else: Q.tail.next = p; p.prev = Q.tail; Q.tail = p
def dequeue(Q):
    p = Q.head; Q.head = p.next
    if Q.head is None: Q.tail = None
    else: Q.head.prev = None
    p.next = None; return p


if __name__ == "__main__":
    # Uji 1: kuis "hapusHurufI" (Stack array)
    def hapusHurufI(S):
        tempS = createStack()
        while not isEmpty(S):
            P = pop(S)
            if P != 'i': push(tempS, P)
        while not isEmpty(tempS):
            push(S, pop(tempS))
    S = stack_from(list("init giwit diririt"))
    hapusHurufI(S)
    assert "".join(stack_items(S)) == "nt gwt drrt" and S.top == 11
    print("hapusHurufI OK:", repr("".join(stack_items(S))), "top =", S.top)

    # Uji 2: UTS NadaKu B3 (Queue) - dequeue berurutan lalu dequeue pada antrean kosong
    Q = queue_from(["Pelangi", "Hujan", "Bintang"])
    print("deq:", dequeue(Q).info); enqueue(Q, Elm("Laut"))
    print("deq:", dequeue(Q).info, "| deq:", dequeue(Q).info)
    print("isi Q:", queue_items(Q))
    dequeue(Q)
    try:
        dequeue(Q)
    except AttributeError:
        print("dequeue saat kosong -> akses NIL terdeteksi")

    # Uji 3: SLL - B1 NadaKu "rapikan" (hapus elemen setelah P bila durasi < P)
    D = sll_from([("Senja",200),("Hujan",180),("Pelangi",240),("Laut",230),("Fajar",250)])
    P = D.first
    while P is not None and P.next is not None:
        if P.next.info[1] < P.info[1]: P.next = P.next.next
        else: P = P.next
    print("SLL akhir:", [x[0] for x in sll_items(D)])
