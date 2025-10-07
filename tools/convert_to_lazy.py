#!/usr/bin/env python3
"""
Taxonomy Explorer Lazy Loading Converter

Converts a nested object JSON tree into lazy loading format with manifest.json
and separate chunk files for each major branch.

Usage:
    python convert_to_lazy.py input.json output_dir [--min-children N] [--max-depth D]

Arguments:
    input.json    - Path to input nested JSON file
    output_dir    - Directory to write manifest.json and chunk files

Options:
    --min-children N  - Minimum children count to split into separate file (default: 10)
    --max-depth D     - Maximum depth to split (default: 3)
"""

import json
import os
import argparse
import re
from typing import Dict, Any, List, Tuple
import uuid

def count_descendants(node: Dict[str, Any]) -> int:
    """Count total descendants of a node."""
    if not isinstance(node, dict):
        return 0

    # Handle both structured format (with children array) and nested object format
    if 'children' in node:
        children = node.get('children', [])
        if not isinstance(children, list):
            return 0
        count = len(children)
        for child in children:
            count += count_descendants(child)
        return count
    else:
        # Nested object format - count non-metadata keys
        child_keys = [k for k in node.keys() if k not in ['name', 'level', 'lazy', 'id']]
        count = 0
        for child_key in child_keys:
            child_obj = node[child_key]
            if isinstance(child_obj, dict):
                count += 1 + count_descendants(child_obj)  # +1 for the child itself
        return count

def should_split_node(node: Dict[str, Any], min_children: int, max_depth: int, current_depth: int = 0) -> bool:
    """Determine if a node should be split into a separate file."""
    if not isinstance(node, dict):
        return False

    # Handle both structured format (with children array) and nested object format
    if 'children' in node:
        children = node.get('children', [])
        if not isinstance(children, list):
            return False
        child_count = len(children)
        children_list = children
    else:
        # Nested object format - count direct child objects
        child_keys = [k for k in node.keys() if k not in ['name', 'level', 'lazy', 'id']]
        child_count = len(child_keys)
        children_list = [node[k] for k in child_keys if isinstance(node[k], dict)]

    # Split if we have enough children and haven't exceeded max depth
    if child_count >= min_children and current_depth < max_depth:
        return True

    # Also split if any child has many descendants (indicating major branches)
    for child in children_list:
        if count_descendants(child) >= min_children * 3:
            return True

    return False

def split_tree(node: Dict[str, Any], base_path: str, min_children: int, max_depth: int,
               current_depth: int = 0, processed_files: Dict[str, Dict] = None) -> Dict[str, Any]:
    """
    Recursively split tree into chunks, returning modified node with lazy flags.
    Handles both structured format (children arrays) and nested object format.
    """
    if processed_files is None:
        processed_files = {}

    if not isinstance(node, dict):
        return node

    # Copy node to avoid modifying original
    result = dict(node)

    if 'children' in result and isinstance(result['children'], list):
        # Structured format with children array
        children = result['children']

        if should_split_node(result, min_children, max_depth, current_depth):
            # Generate unique filename for this subtree
            # Sanitize filename: replace problematic characters
            safe_name = re.sub(r'[^\w\-_\.]', '_', result.get('name', 'node').lower())
            filename = f"{safe_name}_{str(uuid.uuid4())[:8]}.json"

            # Create the subtree file
            subtree_data = {
                'name': result['name'],
                'level': result.get('level', current_depth),
                'children': children
            }

            # Recursively process children in the subtree
            processed_subtree = split_tree(subtree_data, base_path, min_children, max_depth,
                                         current_depth + 1, processed_files)

            # Write subtree file
            filepath = os.path.join(base_path, filename)
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(processed_subtree, f, indent=2, ensure_ascii=False)

            processed_files[filename] = {
                'name': result['name'],
                'file': filename,
                'descendants': count_descendants(result) + 1
            }

            # Replace children with lazy placeholder
            result['children'] = []
            result['lazy'] = True
            result['id'] = filename
        else:
            # Process children in place
            result['children'] = [
                split_tree(child, base_path, min_children, max_depth, current_depth + 1, processed_files)
                for child in children
            ]
    else:
        # Nested object format
        child_keys = [k for k in result.keys() if k not in ['name', 'level', 'lazy', 'id']]

        if should_split_node(result, min_children, max_depth, current_depth):
            # Generate unique filename for this subtree
            node_name = result.get('name', list(child_keys)[0] if child_keys else 'node')
            # Sanitize filename: replace problematic characters
            safe_name = re.sub(r'[^\w\-_\.]', '_', node_name.lower())
            filename = f"{safe_name}_{str(uuid.uuid4())[:8]}.json"

            # Convert nested format to structured format for the subtree
            subtree_data = {
                'name': node_name,
                'level': result.get('level', current_depth),
                'children': []
            }

            # Convert child objects to structured format
            for child_key in child_keys:
                child_obj = result[child_key]
                if isinstance(child_obj, dict):
                    structured_child = {'name': child_key}
                    structured_child.update(child_obj)
                    # Recursively process this child
                    processed_child = split_tree(structured_child, base_path, min_children, max_depth,
                                               current_depth + 1, processed_files)
                    subtree_data['children'].append(processed_child)

            # Write subtree file
            filepath = os.path.join(base_path, filename)
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(subtree_data, f, indent=2, ensure_ascii=False)

            processed_files[filename] = {
                'name': node_name,
                'file': filename,
                'descendants': count_descendants(result) + 1
            }

            # Replace nested children with lazy placeholder
            for key in child_keys:
                del result[key]
            result['lazy'] = True
            result['id'] = filename
        else:
            # Process children in place - convert nested to structured temporarily
            for child_key in child_keys:
                child_obj = result[child_key]
                if isinstance(child_obj, dict):
                    structured_child = {'name': child_key}
                    structured_child.update(child_obj)
                    result[child_key] = split_tree(structured_child, base_path, min_children, max_depth,
                                                 current_depth + 1, processed_files)

    return result

def create_manifest(root: Dict[str, Any], processed_files: Dict[str, Any], output_dir: str) -> None:
    """Create manifest.json file."""
    # Handle both structured and nested formats
    if 'children' in root:
        children = root.get('children', [])
        manifest_children = children
    else:
        # Convert nested format to structured for manifest
        child_keys = [k for k in root.keys() if k not in ['name', 'level', 'lazy', 'id']]
        manifest_children = []
        for child_key in child_keys:
            child_obj = root[child_key]
            if isinstance(child_obj, dict):
                structured_child = {'name': child_key}
                structured_child.update(child_obj)
                manifest_children.append(structured_child)

    manifest = {
        'name': root.get('name', 'Life'),
        'level': root.get('level', 0),
        'children': manifest_children,
        'version': 'lazy-1.0',
        'total_files': len(processed_files) + 1,  # +1 for manifest
        'files': list(processed_files.values()),
        'metadata': {
            'description': 'Lazy loading taxonomy data',
            'min_children_threshold': args.min_children,
            'max_depth': args.max_depth
        }
    }

    # Add total nodes count
    total_nodes = count_descendants(root) + 1  # +1 for root
    manifest['total_nodes'] = total_nodes

    manifest_path = os.path.join(output_dir, 'manifest.json')
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    print(f"Created manifest.json with {total_nodes} total nodes")
    print(f"Split into {len(processed_files)} chunk files")

def main():
    parser = argparse.ArgumentParser(description='Convert nested JSON tree to lazy loading format')
    parser.add_argument('input', help='Input JSON file path')
    parser.add_argument('output_dir', help='Output directory for manifest and chunks')
    parser.add_argument('--min-children', type=int, default=10,
                       help='Minimum children count to split (default: 10)')
    parser.add_argument('--max-depth', type=int, default=3,
                       help='Maximum depth to split (default: 3)')

    global args
    args = parser.parse_args()

    # Read input file
    print(f"Reading {args.input}...")
    with open(args.input, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Create output directory
    os.makedirs(args.output_dir, exist_ok=True)

    # Normalize root level - handle nested format where root might be {"Life": {...}}
    if isinstance(data, dict) and len(data) == 1 and 'Life' in data:
        # Convert {"Life": {...}} to proper root structure
        root_data = data['Life']
        if isinstance(root_data, dict):
            root_data['name'] = 'Life'
            root_data['level'] = 0
        processed_data = root_data
    else:
        processed_data = data

    # Process the tree
    print(f"Processing tree with min_children={args.min_children}, max_depth={args.max_depth}...")
    processed_files = {}
    processed_tree = split_tree(processed_data, args.output_dir, args.min_children, args.max_depth,
                               processed_files=processed_files)

    # Create manifest
    create_manifest(processed_tree, processed_files, args.output_dir)

    print(f"Conversion complete! Files written to {args.output_dir}")
    print(f"Use manifest.json as your dataset entry point.")

if __name__ == '__main__':
    main()
