#!/usr/bin/env python3
"""
Split large tree.json files into multiple parts for GitHub's 50MB limit.
Optimizes for 10-20MB chunks for best performance while staying well under limits.
"""

import json
import os
import sys
import argparse
from pathlib import Path

# Global formatting style for size calc and writing
FORMAT_STYLE = 'pretty'  # 'minify' or 'pretty'

def json_bytes(obj):
    if FORMAT_STYLE == 'pretty':
        s = json.dumps(obj, indent=2, ensure_ascii=False)
    else:
        s = json.dumps(obj, separators=(',', ':'), ensure_ascii=False)
    return len(s.encode('utf-8'))

def json_dump_to_file(obj, fp):
    if FORMAT_STYLE == 'pretty':
        json.dump(obj, fp, indent=2, ensure_ascii=False)
    else:
        json.dump(obj, fp, separators=(',', ':'), ensure_ascii=False)


def get_file_size_mb(file_path):
    """Get file size in MB."""
    return os.path.getsize(file_path) / (1024 * 1024)


def count_nodes(node):
    """Recursively count total nodes in tree."""
    if not isinstance(node, dict):
        return 0
    
    count = 1  # Current node
    children = node.get('children', [])
    if isinstance(children, list):
        for child in children:
            count += count_nodes(child)
    return count


def estimate_node_size_mb(node):
    """Estimate node size in MB without full serialization for performance."""
    if not isinstance(node, dict):
        return 0.001
    
    # Quick estimate: average JSON overhead per field + string lengths
    size_bytes = 50  # Base object overhead
    
    for key, value in node.items():
        size_bytes += len(str(key)) + 10  # Key + JSON syntax
        if isinstance(value, str):
            size_bytes += len(value) + 2  # String + quotes
        elif isinstance(value, (int, float)):
            size_bytes += 20  # Number representation
        elif isinstance(value, list):
            size_bytes += len(value) * 100  # Rough estimate per list item
        else:
            size_bytes += 50  # Other types
    
    return size_bytes / (1024 * 1024)

def extract_subtrees(node, max_size_mb=15, current_path="", chunk_counter=[0]):
    """
    Extract subtrees that fit within size limit.
    Handles flat structures by batching children.
    Returns list of (path, subtree) tuples.
    """
    if not isinstance(node, dict):
        return []
    
    children = node.get('children', [])
    node_without_children = {k: v for k, v in node.items() if k != 'children'}
    
    # If no children, return as-is
    if not children:
        return [(current_path, node)]
    
    # For nodes with many children, batch them into chunks
    if len(children) > 1000:  # Likely a flat structure
        print(f"Detected flat structure with {len(children):,} children at '{current_path or 'root'}', batching...")
        return extract_flat_structure(node, max_size_mb, current_path, chunk_counter)
    
    # Normal hierarchical processing
    # Estimate total size first
    total_size_mb = estimate_node_size_mb(node_without_children)
    for child in children:
        total_size_mb += estimate_node_size_mb(child)
    
    # If small enough, return as single chunk
    if total_size_mb <= max_size_mb:
        return [(current_path, node)]
    
    # Split by children
    chunks = []
    current_chunk = node_without_children.copy()
    current_chunk['children'] = []
    current_chunk_size = estimate_node_size_mb(node_without_children)
    
    for i, child in enumerate(children):
        child_size_mb = estimate_node_size_mb(child)
        child_name = child.get('name', f'child_{i}')
        child_path = f"{current_path}/{child_name}" if current_path else child_name
        
        # If adding this child would exceed limit, save current chunk and start new one
        if current_chunk_size + child_size_mb > max_size_mb and current_chunk['children']:
            chunks.append((f"{current_path}_part_{chunk_counter[0]}", current_chunk))
            chunk_counter[0] += 1
            current_chunk = node_without_children.copy()
            current_chunk['children'] = []
            current_chunk_size = estimate_node_size_mb(node_without_children)
        
        # If single child is too big, recursively split it
        if child_size_mb > max_size_mb:
            # Save current chunk if it has content
            if current_chunk['children']:
                chunks.append((f"{current_path}_part_{chunk_counter[0]}", current_chunk))
                chunk_counter[0] += 1
                current_chunk = node_without_children.copy()
                current_chunk['children'] = []
                current_chunk_size = estimate_node_size_mb(node_without_children)
            
            # Recursively split the large child
            child_chunks = extract_subtrees(child, max_size_mb, child_path, chunk_counter)
            chunks.extend(child_chunks)
        else:
            # Add child to current chunk
            current_chunk['children'].append(child)
            current_chunk_size += child_size_mb
    
    # Save remaining chunk if it has content
    if current_chunk['children']:
        chunks.append((f"{current_path}_part_{chunk_counter[0]}", current_chunk))
        chunk_counter[0] += 1
    
    return chunks

def extract_flat_structure(node, max_size_mb=15, current_path="", chunk_counter=[0]):
    """
    Handle flat structures by batching children into size-limited chunks.
    """
    children = node.get('children', [])
    node_without_children = {k: v for k, v in node.items() if k != 'children'}
    max_bytes = int(max_size_mb * 1024 * 1024)
    # Compute exact bytes of the wrapper without children
    wrapper_no_children = node_without_children.copy()
    wrapper_no_children['children'] = []
    base_bytes = json_bytes(wrapper_no_children)
    
    chunks = []
    current_chunk = node_without_children.copy()
    current_chunk['children'] = []
    current_size_bytes = base_bytes
    
    batch_size = 100  # Start with batches of 100 children
    processed = 0
    
    print(f"Processing {len(children):,} children in batches...")
    
    while processed < len(children):
        # Take a batch of children
        batch_end = min(processed + batch_size, len(children))
        batch = children[processed:batch_end]
        
        # Estimate exact byte size for this batch
        batch_bytes = 0
        child_sizes = []
        for c in batch:
            try:
                child_bytes = json_bytes(c)
            except Exception:
                child_bytes = 1024
            child_sizes.append(child_bytes)
            batch_bytes += child_bytes
        
        # If batch is too big, reduce batch size
        if batch_bytes > max_bytes - base_bytes and batch_size > 1:
            batch_size = max(1, batch_size // 2)
            continue
        
        # If current chunk + batch exceeds limit, save current chunk
        if current_size_bytes + batch_bytes > max_bytes and current_chunk['children']:
            chunk_path = f"{current_path}_part_{chunk_counter[0]}" if current_path else f"part_{chunk_counter[0]}"
            chunks.append((chunk_path, current_chunk))
            chunk_counter[0] += 1
            
            current_chunk = node_without_children.copy()
            current_chunk['children'] = []
            current_size_bytes = base_bytes
            
            print(f"  Saved chunk {chunk_counter[0]-1} with {len(chunks[-1][1]['children']):,} children")
        
        # Add batch to current chunk
        # Append children individually, flushing as needed to maintain hard limit
        for c, c_bytes in zip(batch, child_sizes):
            if current_chunk['children'] and current_size_bytes + c_bytes > max_bytes:
                # Flush current
                chunk_path = f"{current_path}_part_{chunk_counter[0]}" if current_path else f"part_{chunk_counter[0]}"
                chunks.append((chunk_path, current_chunk))
                chunk_counter[0] += 1
                current_chunk = node_without_children.copy()
                current_chunk['children'] = []
                current_size_bytes = base_bytes
            # If a single child exceeds max_bytes, write it as its own chunk
            if c_bytes > max_bytes:
                solo = node_without_children.copy()
                solo['children'] = [c]
                chunk_path = f"{current_path}_part_{chunk_counter[0]}" if current_path else f"part_{chunk_counter[0]}"
                chunks.append((chunk_path, solo))
                chunk_counter[0] += 1
            else:
                current_chunk['children'].append(c)
                current_size_bytes += c_bytes
        processed = batch_end
        
        # Adaptive batch sizing
        if batch_bytes < max_bytes * 0.1:  # If batch was too small, increase
            batch_size = min(batch_size * 2, 1000)
        elif batch_bytes > max_bytes * 0.5:  # If batch was large, decrease
            batch_size = max(batch_size // 2, 1)
    
    # Save final chunk
    if current_chunk['children']:
        chunk_path = f"{current_path}_part_{chunk_counter[0]}" if current_path else f"part_{chunk_counter[0]}"
        chunks.append((chunk_path, current_chunk))
        chunk_counter[0] += 1
        print(f"  Saved final chunk {chunk_counter[0]-1} with {len(current_chunk['children']):,} children")
    
    print(f"Split into {len(chunks)} chunks")
    return chunks


def is_structured_tree(obj):
    """Returns True if object looks like { name, children:[...] }"""
    return isinstance(obj, dict) and (
        'children' in obj or 'name' in obj
    )


def is_nested_map(obj):
    """Returns True if object looks like a nested key map: { Root: { ... } }"""
    return isinstance(obj, dict) and not is_structured_tree(obj)


def estimate_map_entry_bytes(wrapper_key, key, value, sample_children_limit=50):
    """Estimate size of a single nested-map entry by sampling serialization of a small slice."""
    try:
        # To keep it fast, shallow-clone a tiny representative slice
        if isinstance(value, dict):
            # Take a few nested keys only to cap serialization effort
            it = iter(value.items())
            limited = {}
            for _ in range(sample_children_limit):
                try:
                    k2, v2 = next(it)
                except StopIteration:
                    break
                limited[k2] = v2 if not isinstance(v2, dict) else {}
            sample_obj = {wrapper_key: {key: limited}} if wrapper_key else {key: limited}
        else:
            sample_obj = {wrapper_key: {key: value}} if wrapper_key else {key: value}
        s = json.dumps(sample_obj, separators=(',', ':'), ensure_ascii=False)
        # Heuristic multiplier to compensate for trimmed nested content
        return max(len(s), 128)
    except Exception:
        return 1024


def chunk_nested_map(root_obj, max_size_mb=15, current_path=""):
    """
    Split a nested key map into size-limited chunks by batching sibling keys.
    Returns list of (path, chunk_obj) tuples, where chunk_obj is also a nested map.
    """
    assert isinstance(root_obj, dict)
    keys = list(root_obj.keys())
    if len(keys) == 0:
        return [(current_path, root_obj)]
    
    max_bytes = int(max_size_mb * 1024 * 1024)

    # If only one root key, go one level deeper, preserving the root key in each chunk.
    if len(keys) == 1:
        root_key = keys[0]
        child_map = root_obj[root_key]
        if not isinstance(child_map, dict):
            return [(current_path, root_obj)]
        child_keys = list(child_map.keys())
        if not child_keys:
            return [(current_path, root_obj)]

        # Precompute exact size of each entry when wrapped under root_key
        sizes = []
        for k in child_keys:
            try:
                sample_obj = {root_key: {k: child_map[k]}}
                s = len(json.dumps(sample_obj, separators=(',', ':'), ensure_ascii=False).encode('utf-8'))
            except Exception:
                s = 1024
            sizes.append(s)

        chunks = []
        acc_keys = []
        acc_bytes = 0
        part_idx = 0
        for k, s in zip(child_keys, sizes):
            # If a single entry is larger than max_bytes, split it recursively
            if s > max_bytes and isinstance(child_map.get(k), dict):
                # flush any accumulated keys first
                if acc_keys:
                    chunk = {root_key: {kk: child_map[kk] for kk in acc_keys}}
                    part_path = f"{current_path}/{root_key}_part_{part_idx}" if current_path else f"{root_key}_part_{part_idx}"
                    chunks.append((part_path, chunk))
                    part_idx += 1
                    acc_keys = []
                    acc_bytes = 0
                # Recursively split the oversized child map
                sub_chunks = chunk_nested_map({k: child_map[k]}, max_size_mb, f"{current_path}/{root_key}" if current_path else root_key)
                # Wrap each subchunk back under root_key
                for sub_path, sub_chunk in sub_chunks:
                    wrapped = {root_key: sub_chunk}
                    chunks.append((sub_path, wrapped))
                continue

            if acc_keys and acc_bytes + s > max_bytes:
                # flush
                chunk = {root_key: {kk: child_map[kk] for kk in acc_keys}}
                part_path = f"{current_path}/{root_key}_part_{part_idx}" if current_path else f"{root_key}_part_{part_idx}"
                chunks.append((part_path, chunk))
                part_idx += 1
                acc_keys = []
                acc_bytes = 0
            acc_keys.append(k)
            acc_bytes += s
        if acc_keys:
            chunk = {root_key: {kk: child_map[kk] for kk in acc_keys}}
            part_path = f"{current_path}/{root_key}_part_{part_idx}" if current_path else f"{root_key}_part_{part_idx}"
            chunks.append((part_path, chunk))
        return chunks

    # Multiple top-level keys; batch them directly at this level using exact sizes
    sizes = []
    for k in keys:
        try:
            sample_obj = {k: root_obj[k]}
            s = len(json.dumps(sample_obj, separators=(',', ':'), ensure_ascii=False).encode('utf-8'))
        except Exception:
            s = 1024
        sizes.append(s)

    chunks = []
    acc_keys = []
    acc_bytes = 0
    part_idx = 0
    for k, s in zip(keys, sizes):
        # If a single entry is larger than max_bytes, split it recursively if possible
        if s > max_bytes and isinstance(root_obj.get(k), dict):
            if acc_keys:
                chunk = {kk: root_obj[kk] for kk in acc_keys}
                part_path = f"{current_path}_part_{part_idx}" if current_path else f"part_{part_idx}"
                chunks.append((part_path, chunk))
                part_idx += 1
                acc_keys = []
                acc_bytes = 0
            sub_chunks = chunk_nested_map({k: root_obj[k]}, max_size_mb, current_path)
            chunks.extend(sub_chunks)
            continue

        if acc_keys and acc_bytes + s > max_bytes:
            chunk = {kk: root_obj[kk] for kk in acc_keys}
            part_path = f"{current_path}_part_{part_idx}" if current_path else f"part_{part_idx}"
            chunks.append((part_path, chunk))
            part_idx += 1
            acc_keys = []
            acc_bytes = 0
        acc_keys.append(k)
        acc_bytes += s
    if acc_keys:
        chunk = {kk: root_obj[kk] for kk in acc_keys}
        part_path = f"{current_path}_part_{part_idx}" if current_path else f"part_{part_idx}"
        chunks.append((part_path, chunk))
    return chunks


def split_tree_file(input_file, output_dir="data", max_size_mb=15):
    """
    Split tree.json into multiple files under size limit.
    
    Args:
        input_file: Path to input tree.json
        output_dir: Directory to save split files
        max_size_mb: Maximum size per file in MB (default 15MB)
    """
    input_path = Path(input_file)
    output_path = Path(output_dir)
    
    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_file}")
    
    print(f"Loading {input_file} ({get_file_size_mb(input_file):.1f}MB)...")
    
    with open(input_path, 'r', encoding='utf-8') as f:
        tree_text = f.read()
        tree_data = json.loads(tree_text)
    
    print(f"Tree loaded. Counting nodes...")
    total_nodes = count_nodes(tree_data)
    print(f"Total nodes: {total_nodes:,}")
    
    print(f"Splitting into chunks of max {max_size_mb}MB...")
    if is_nested_map(tree_data):
        # Nested key map: split by batching sibling keys
        chunks = chunk_nested_map(tree_data, max_size_mb)
    else:
        # Structured tree: split by children arrays
        chunk_counter = [0]
        chunks = extract_subtrees(tree_data, max_size_mb, "", chunk_counter)
    
    # Create output directory
    output_path.mkdir(parents=True, exist_ok=True)
    
    # Save chunks
    manifest = {
        "version": "1.0",
        "total_files": len(chunks),
        "max_size_mb": max_size_mb,
        "total_nodes": total_nodes,
        "files": []
    }
    
    for i, (path, chunk) in enumerate(chunks):
        # Generate short, safe filename to avoid Windows/Git path length limits
        filename = f"tree_part_{i:05d}.json"
        
        file_path = output_path / filename
        
        print(f"  Writing {filename}... ", end='', flush=True)
        
        # Save chunk with progress
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                json_dump_to_file(chunk, f)
            
            file_size_mb = get_file_size_mb(file_path)
            chunk_nodes = count_nodes(chunk)

            manifest["files"].append({
                "filename": filename,
                "path": path,
                "size_mb": round(file_size_mb, 2),
                "nodes": chunk_nodes,
                # Mark first file as root for simplicity; loader can merge nested maps
                "is_root": i == 0
            })

            print(f"{file_size_mb:.1f}MB, {chunk_nodes:,} nodes ✓")
            
        except KeyboardInterrupt:
            print("Interrupted!")
            if file_path.exists():
                file_path.unlink()  # Clean up partial file
            raise
        except Exception as e:
            print(f"Error: {e}")
            if file_path.exists():
                file_path.unlink()  # Clean up partial file
            raise
    
    # Save manifest
    manifest_path = output_path / "manifest.json"
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    
    # Compute total output size by summing actual file sizes
    total_output_size = sum(get_file_size_mb(output_path / f["filename"]) for f in manifest["files"])
    # Compute source size exactly from the input text
    source_size_mb = len(tree_text.encode('utf-8')) / (1024 * 1024)
    
    print(f"\nSplit complete!")
    print(f"  Input: {source_size_mb:.1f}MB")
    print(f"  Output: {len(chunks)} files, {total_output_size:.1f}MB total")
    print(f"  Saved to: {output_dir}/")
    print(f"  Manifest: {manifest_path}")
    
    # Check GitHub limits
    oversized = [f for f in manifest["files"] if f["size_mb"] > 50]
    if oversized:
        print(f"\nWarning: {len(oversized)} files exceed GitHub's 50MB limit:")
        for f in oversized:
            print(f"  {f['filename']}: {f['size_mb']}MB")
        print("Consider reducing max_size_mb and re-running.")
    else:
        print(f"\nAll files are under GitHub's 50MB limit ✓")


def main():
    parser = argparse.ArgumentParser(description="Split large tree.json files for GitHub")
    parser.add_argument("input_file", help="Path to input tree.json file")
    parser.add_argument("-o", "--output", default="data", help="Output directory (default: data)")
    parser.add_argument("-s", "--size", type=float, default=15, help="Max size per file in MB (default: 15)")
    parser.add_argument("-v", "--verbose", action="store_true", help="Verbose output")
    
    args = parser.parse_args()
    
    try:
        split_tree_file(args.input_file, args.output, args.size)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
